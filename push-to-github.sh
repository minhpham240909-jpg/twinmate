#!/bin/bash

echo "=== GitHub Push Helper for Clerva App ==="
echo ""
echo "First, make sure you've created a GitHub repository."
echo "Go to: https://github.com/new"
echo ""
read -p "Enter your GitHub username: " username
read -p "Enter your repository name (default: clerva-app): " repo_name
repo_name=${repo_name:-clerva-app}

echo ""
echo "Adding remote repository..."
git remote add origin "https://github.com/$username/$repo_name.git"

echo ""
echo "Checking remote..."
git remote -v

echo ""
echo "Pushing to GitHub..."
git push -u origin main

echo ""
echo "Done! Your code should now be on GitHub at:"
echo "https://github.com/$username/$repo_name"
