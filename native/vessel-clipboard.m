#import <AppKit/AppKit.h>
#include <unistd.h>

static NSArray *FilePaths(NSPasteboard *board) {
  NSMutableArray *files = [NSMutableArray new];
  for (NSPasteboardItem *item in board.pasteboardItems) {
    NSString *value = [item stringForType:NSPasteboardTypeFileURL];
    NSURL *url = value ? [NSURL URLWithString:value] : nil;
    if (url.isFileURL) [files addObject:url.path];
  }
  // Older apps expose a single pasteboard item containing the complete file list.
  id legacy = [board propertyListForType:@"NSFilenamesPboardType"];
  if ([legacy isKindOfClass:NSArray.class] && [legacy count] > files.count) return legacy;
  return files;
}

// Keep native pasteboard polling out of Electron's main event loop. Only changes
// trigger Electron image/text reads; file URLs preserve Finder's multi-selection.
int main(int argc, const char *argv[]) {
  @autoreleasepool {
    NSPasteboard *board = NSPasteboard.generalPasteboard;
    if (argc > 1 && strcmp(argv[1], "--read-files") == 0) {
      NSData *data = [NSJSONSerialization dataWithJSONObject:FilePaths(board) options:0 error:nil];
      puts([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding].UTF8String);
      return 0;
    }
    if (argc > 1 && strcmp(argv[1], "--write-files") == 0) {
      NSMutableArray<NSPasteboardItem *> *items = [NSMutableArray new];
      for (int i = 2; i < argc; i++) {
        NSURL *url = [NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[i]]];
        NSPasteboardItem *item = [NSPasteboardItem new];
        // Materialize the representation before this short-lived writer exits.
        [item setString:url.absoluteString forType:NSPasteboardTypeFileURL];
        [items addObject:item];
      }
      if (!items.count) return 1;
      NSMutableArray *paths = [NSMutableArray new];
      for (int i = 2; i < argc; i++) [paths addObject:[NSString stringWithUTF8String:argv[i]]];
      [board clearContents];
      BOOL written = [board writeObjects:items];
      // NSPasteboard (unlike NSPasteboardItem) translates legacy type names.
      [board setPropertyList:paths forType:@"NSFilenamesPboardType"];
      return written ? 0 : 1;
    }
    pid_t parent = getppid();
    NSInteger previous = -1;
    while (getppid() == parent) {
      @autoreleasepool {
        NSInteger current = board.changeCount;
        if (current != previous) {
          previous = current;
          NSData *data = [NSJSONSerialization dataWithJSONObject:@{ @"files":FilePaths(board) } options:0 error:nil];
          puts([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding].UTF8String);
          fflush(stdout);
        }
        usleep(250000);
      }
    }
  }
  return 0;
}
