#!/bin/bash

# Fix Auth Redirect Loops
# Changes router.push('/auth/...) to router.replace('/auth/...) to prevent redirect loops

BASE_DIR="/Users/minhpham/Documents/minh project.html/clerva-app/src/app"

# Find all .tsx files that use router.push('/auth
FILES=$(grep -rl "router\.push('/auth" "$BASE_DIR" 2>/dev/null)

echo "🔧 Fixing auth redirect loops in $(echo "$FILES" | wc -l | tr -d ' ') files..."
echo ""

for file in $FILES; do
    # Check if file contains router.push('/auth
    if grep -q "router\.push('/auth" "$file"; then
        echo "✏️  Fixing: $file"

        # Replace router.push with router.replace for /auth redirects
        sed -i '' "s/router\.push('\\/auth/router.replace('\\/auth/g" "$file"

        echo "   ✅ Changed router.push -> router.replace"
    fi
done

echo ""
echo "✅ All auth redirects fixed!"
echo ""
echo "📋 Summary:"
echo "   - Changed router.push() to router.replace() for auth redirects"
echo "   - This prevents redirect loops and browser history pollution"
echo "   - Pages will now properly redirect without adding to back button history"
