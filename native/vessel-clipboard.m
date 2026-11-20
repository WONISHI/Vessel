#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
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
    if (argc > 1 && strcmp(argv[1], "--frontmost-pid") == 0) {
      printf("%d\n", NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier);
      return 0;
    }
    if (argc > 2 && strcmp(argv[1], "--paste-to") == 0) {
      int pid = atoi(argv[2]);
      NSRunningApplication *target = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
      if (pid <= 0 || !target || target.terminated) { fprintf(stderr, "原来的输入应用已关闭"); return 1; }
      NSDictionary *options = @{(__bridge NSString *)kAXTrustedCheckOptionPrompt: @YES};
      if (!AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options)) { fprintf(stderr, "请在系统设置的隐私与安全性 → 辅助功能中允许 Vessel，内容已复制，可先手动粘贴"); return 1; }
      [target activateWithOptions:0];
      AXUIElementRef application = AXUIElementCreateApplication(pid);
      AXUIElementSetAttributeValue(application, kAXFrontmostAttribute, kCFBooleanTrue);
      CFRelease(application);
      BOOL focused = NO;
      for (int i = 0; i < 40; i++) {
        [NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.025]];
        if (NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier == pid) { focused = YES; break; }
      }
      if (!focused) { fprintf(stderr, "无法恢复原来的输入应用"); return 1; }
      [NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.08]];
      if (NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier != pid) { fprintf(stderr, "输入焦点已改变，已取消自动粘贴"); return 1; }
      CGEventRef down = CGEventCreateKeyboardEvent(NULL, 9, true);
      CGEventRef up = CGEventCreateKeyboardEvent(NULL, 9, false);
      if (!down || !up) { if (down) CFRelease(down); if (up) CFRelease(up); return 1; }
      CGEventSetFlags(down, kCGEventFlagMaskCommand);
      CGEventSetFlags(up, kCGEventFlagMaskCommand);
      CGEventPost(kCGHIDEventTap, down);
      CGEventPost(kCGHIDEventTap, up);
      CFRelease(down); CFRelease(up);
      return 0;
    }
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
