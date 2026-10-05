// macOS minimized thumbnails use the app bundle icon, not app.dock.setIcon().
const fs = require('node:fs'), path = require('node:path'), {execFileSync}=require('node:child_process')
if(process.platform==='darwin') {
 const executable=require('electron')
 const contents=path.resolve(executable,'../..')
 const icon=path.join(contents,'Resources','vessel.icns')
 const source=path.resolve(__dirname,'../build/icon.icns')
 if(!fs.existsSync(icon)||!fs.readFileSync(icon).equals(fs.readFileSync(source))) fs.copyFileSync(source,icon)
 const plist=path.join(contents,'Info.plist')
 const current=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleIconFile',plist],{encoding:'utf8'}).trim()
 if(current!=='vessel.icns') execFileSync('/usr/libexec/PlistBuddy',['-c','Set :CFBundleIconFile vessel.icns',plist])
}
