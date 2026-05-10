# Quick Start - 5 Minutes to Running

## Install and Run

```bash
# 1. Navigate to extension directory
cd "/Users/divy.cholera/localhost/repos/vs parser"

# 2. Install dependencies (takes ~30 seconds)
npm install

# 3. Compile TypeScript
npm run compile

# 4. Launch in VS Code
code .
```

## Test the Extension

Once VS Code opens:

1. **Press `F5`** - This launches the Extension Development Host

2. **Open a test file** in the new window:
   - `Cmd+O` to open file
   - Navigate to: `/Users/divy.cholera/localhost/repos/sn-squadra-ws/app-squadra-workspace/src/main/plugins/com.snc.cwm/update/`
   - Select any `sys_ux_macroponent_*.xml` file

3. **Trigger validation** (any method):
   - Save the file: `Cmd+S`
   - Right-click → "Validate Macroponent"
   - Command Palette (`Cmd+Shift+P`) → "Validate Macroponent"

## What You Should See

✅ **Red underlines** on lines with JSON errors  
✅ **Problems panel** (View → Problems) showing all issues  
✅ **Status bar** (bottom right) showing error count: `🔴 0/5`  
✅ **Hover tooltips** with detailed error messages  
✅ **Error navigation** by clicking status bar counter  

## Verify All Features

### 1. Error Highlighting
Look for red-highlighted regions in the JSON content

### 2. Hover Information
Hover over any error to see:
- Error type (ERROR/WARNING)
- Detailed message
- Position information

### 3. Navigation
Click the error counter in status bar (e.g., `🔴 1/5`):
- Automatically jumps to error location
- Click again to cycle through all errors

### 4. Problems Panel
Open via `Cmd+Shift+M` to see:
- All errors and warnings listed
- Line numbers and descriptions
- Click any error to jump to location

### 5. Auto-validation on Save
Make a change and save - validation runs automatically

## Common Test Scenarios

### Test 1: Missing Comma Error
Open any macroponent file, find a JSON section, remove a comma:
```json
{
  "test": "value"
  "missing": "comma"
}
```
**Expected**: Red highlight on line, error in Problems panel

### Test 2: Duplicate Key Error
Add a duplicate key in any JSON object:
```json
{
  "test": "value1",
  "test": "value2"
}
```
**Expected**: Error about duplicate key

### Test 3: Unclosed Bracket
Remove a closing bracket from an array or object:
```json
{
  "items": [
    {"id": 1}
}
```
**Expected**: Error about unclosed array

## Troubleshooting

### Extension doesn't activate
- Verify filename starts with `sys_ux_macroponent`
- Check it ends with `.xml`
- Look at Output panel: View → Output → "Extension Host"

### No errors showing
- The file might be valid! Try introducing an error
- Check if validation on save is enabled in settings

### Compilation errors
```bash
rm -rf out/
npm run compile
```

## Next Steps

- Read `README.md` for full documentation
- Check `SETUP.md` for detailed development guide
- Customize settings in VS Code preferences
- Test with complex real-world macroponent files

## Development Mode

To keep working on the extension:

```bash
# Start watch mode (auto-recompile on changes)
npm run watch

# In VS Code, press F5 to launch
# After making changes, press Cmd+R in Extension Development Host to reload
```

## Create Installable Package

```bash
npm install -g @vscode/vsce
npm run package
# Installs macroponent-validator-1.0.0.vsix
code --install-extension macroponent-validator-1.0.0.vsix
```

---

**You're all set!** The extension is production-ready with:
- ✅ Complete validation logic from your Chrome extension
- ✅ Full error detection (all errors in single pass)
- ✅ Visual error highlighting with hovers
- ✅ Error navigation UI
- ✅ Context menu integration
- ✅ Auto-validation on save
- ✅ Efficient handling of large files
