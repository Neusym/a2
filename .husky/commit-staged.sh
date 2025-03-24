#!/usr/bin/env sh

# Echo with color
info() {
  printf "\033[1;36m%s\033[0m\n" "$1"
}

success() {
  printf "\033[1;32m%s\033[0m\n" "$1"
}

warning() {
  printf "\033[1;33m%s\033[0m\n" "$1"
}

error() {
  printf "\033[1;31m%s\033[0m\n" "$1" >&2
}

# Check if there are staged changes
if [ -z "$(git diff --cached --name-only)" ]; then
  error "No staged changes found. Use 'git add' to stage files first."
  exit 1
fi

# Log what files are staged
info "Files staged for commit:"
git diff --cached --name-only

# Check if there are unstaged changes
if [ -n "$(git diff --name-only)" ]; then
  warning "⚠️ You have unstaged changes that will not be included in this commit:"
  git diff --name-only
  
  # Ask if user wants to continue
  printf "\n"
  warning "Do you want to continue with only the staged changes? [y/N] "
  read -r response
  
  if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
    info "Commit canceled. Use 'git add .' to stage all changes."
    exit 0
  fi
fi

# Run lint-staged to ensure code quality
info "Running lint-staged to ensure code quality..."
pnpm lint-staged

# If there are any errors, exit
if [ $? -ne 0 ]; then
  error "lint-staged found issues that need to be fixed"
  exit 1
fi

# Allow custom commit message as parameter
if [ -n "$1" ]; then
  info "Using provided commit message: $1"
  git commit -m "$1"
else
  # Use commitizen for the commit message
  success "All checks passed! Creating commit with commitizen..."
  pnpm commit
fi 