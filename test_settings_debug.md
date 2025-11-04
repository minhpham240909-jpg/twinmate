# Settings Debug Guide

## To debug the "invalid data" error:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try saving any setting
4. Look for these log messages:
   - `[Settings Update] Received body:` - shows what's being sent
   - `[Settings Update] Validation failed:` - shows which fields are failing
   - Look for any fields with invalid types or extra fields

## Common issues:

1. **Null vs undefined**: Some fields might be `null` when they should be `undefined`
2. **Extra database fields**: The response includes `id`, `userId`, `createdAt`, `updatedAt`
3. **Array fields**: `contentFiltering` should be an array, not a string
4. **Enum mismatches**: Check if enum values match exactly (case-sensitive)

## Quick fix to try:

In browser console, run:
```javascript
localStorage.clear()
location.reload()
```

This will reset all cached data and force fresh settings load.
