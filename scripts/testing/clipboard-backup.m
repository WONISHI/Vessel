// Smoke-test utility only: preserve every native pasteboard item and format.
#import <AppKit/AppKit.h>
#include <sys/stat.h>
int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc < 3) return 1;
    NSString *path = [NSString stringWithUTF8String:argv[2]];
    NSPasteboard *board = NSPasteboard.generalPasteboard;
    if (strcmp(argv[1], "backup") == 0) {
      NSMutableArray *items = [NSMutableArray new];
      for (NSPasteboardItem *item in board.pasteboardItems) {
        NSMutableDictionary *formats = [NSMutableDictionary new];
        for (NSString *type in item.types) { NSData *data = [item dataForType:type]; if (data) formats[type] = data; }
        [items addObject:formats];
      }
      NSData *data = [NSPropertyListSerialization dataWithPropertyList:items format:NSPropertyListBinaryFormat_v1_0 options:0 error:nil];
      if (![data writeToFile:path atomically:YES]) return 1;
      chmod(argv[2], 0600);
    } else {
      NSArray *stored = [NSPropertyListSerialization propertyListWithData:[NSData dataWithContentsOfFile:path] options:NSPropertyListImmutable format:nil error:nil];
      if (![stored isKindOfClass:NSArray.class]) return 1;
      NSMutableArray *items = [NSMutableArray new];
      for (NSDictionary *formats in stored) {
        NSPasteboardItem *item = [NSPasteboardItem new];
        for (NSString *type in formats) [item setData:formats[type] forType:type];
        [items addObject:item];
      }
      [board clearContents];
      if (items.count && ![board writeObjects:items]) return 1;
    }
  }
  return 0;
}
