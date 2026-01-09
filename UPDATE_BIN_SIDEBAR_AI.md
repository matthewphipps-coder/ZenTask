# Features Update - Bin, Minimal Sidebar & AI Refinements

## Service Update Notes

### **1. Sidebar & UI Refinements**
- **Minimalist Footer:** Reorganized user info, settings, theme, and logout buttons into a compact, minimalist footer at the bottom left.
- **Removed Green Tint:** Removed the background radial gradient for a cleaner look.
- **Renamed Description:** Task detail field "Description" is now **"Notes"**.

### **2. Soft Delete & 'Bin'**
- **Soft Delete:** Tasks are no longer permanently deleted immediately. They are moved to the "Bin".
- **Bin View:** Added a **"Bin"** filter in the sidebar to view deleted tasks.
- **Drag & Drop:** You can drag tasks onto the "Bin" icon to delete them.
- **Exclusive View:** Deleted tasks do NOT appear in "All", "Today", or "Upcoming".

### **3. AI Chat Improvements**
- **Grey Bubbles:** User chat messages are now a subtle grey instead of green.
- **Text Area Input:** Chat input is now a multiline textarea that supports wrapping (Enter to send, Shift+Enter for new line).
- **Simplified Formatting:** Removed custom client-side formatting logic; ensuring the AI's natural output is displayed cleanly.

### **4. Fixes**
- **Autocomplete Fix:** The "Add new task" input no longer auto-fills with user ID/password data (added `autocomplete="new-password"`).

## Technical Details

### **Database Schema**
- Added `deleted: boolean` field to tasks.
- Queries updated to filter based on `deleted` status client-side (for now).

### **Files Modified**
- **index.html**: Structural changes for sidebar, chat input, and labels.
- **index.css**: Styles for minimalist footer, textarea, grey bubbles, removed background.
- **app.js**: Soft delete logic, filter logic for 'bin', keydown handler for textarea, simplified chat rendering.

---
**Status**: ✅ **Implemented & Ready**
