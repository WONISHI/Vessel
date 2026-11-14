#import <AppKit/AppKit.h>
#import <LocalAuthentication/LocalAuthentication.h>

// No credentials cross this process boundary; only success/failure is returned.
int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc == 2 && strcmp(argv[1], "--check") == 0) return 0;
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    LAContext *context = [LAContext new];
    context.localizedCancelTitle = @"取消";
    context.localizedFallbackTitle = @"使用登录密码";
    NSError *error = nil;
    if (![context canEvaluatePolicy:LAPolicyDeviceOwnerAuthentication error:&error]) return 2;
    [context evaluatePolicy:LAPolicyDeviceOwnerAuthentication
           localizedReason:@"Vessel 需要验证身份以显示已保存的网页密码"
                     reply:^(BOOL success, NSError *authError) {
      // The OS validates the current login user, not an app-created password form.
      exit(success ? 0 : 1);
    }];
    [NSApp run];
    return 1;
  }
}
