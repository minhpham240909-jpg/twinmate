#!/bin/bash

# Script to migrate console.log/error/warn to logger utility
# Usage: ./scripts/migrate-to-logger.sh

echo "🔄 Migrating console statements to logger..."

# Find all TypeScript files in src/app/api
find src/app/api -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
  # Check if file already imports logger
  if ! grep -q "import logger from '@/lib/logger'" "$file" && ! grep -q "import { logger } from" "$file"; then
    # Check if file has console statements
    if grep -q "console\.\(log\|error\|warn\)" "$file"; then
      echo "  📝 Adding logger import to: $file"
      
      # Find the last import statement line number
      last_import=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
      
      if [ -n "$last_import" ]; then
        # Add logger import after the last import
        sed -i.bak "${last_import}a\\
import logger from '@/lib/logger'
" "$file"
        rm "${file}.bak"
      fi
    fi
  fi
  
  # Replace console.error with logger.error
  sed -i.bak "s/console\.error(\([^,)]*\),\s*\([^)]*\))/logger.error(\1, \2 as Error)/g" "$file"
  sed -i.bak "s/console\.error(\([^)]*\))/logger.error(\1)/g" "$file"
  
  # Replace console.log with logger.info
  sed -i.bak "s/console\.log(\([^)]*\))/logger.info(\1)/g" "$file"
  
  # Replace console.warn with logger.warn
  sed -i.bak "s/console\.warn(\([^)]*\))/logger.warn(\1)/g" "$file"
  
  # Clean up backup files
  rm -f "${file}.bak"
done

echo "✅ Migration complete!"
echo "📊 Remaining console statements:"
grep -r "console\.\(log\|error\|warn\)" --include="*.ts" src/app/api | wc -l
