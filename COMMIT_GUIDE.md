# Commit Guide

This project uses a standardized commit workflow with Husky, commitizen, and commitlint to ensure code quality and consistent commit messages.

## Commit Workflow

### Basic Workflow

1. Make your changes
2. Stage the changes with `git add`
3. Commit using one of our provided scripts

```bash
# Use commitizen for interactive commit format (recommended)
pnpm commit-staged

# OR use one of the quick commit commands:
pnpm commit:fix      # For bug fixes
pnpm commit:feat     # For new features
pnpm commit:chore    # For maintenance tasks
pnpm commit:docs     # For documentation updates
pnpm commit:refactor # For code improvements
```

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

#### Types:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Changes that do not affect the meaning of the code (formatting, etc)
- `refactor`: Code changes that neither fix a bug nor add a feature
- `perf`: Code changes that improve performance
- `test`: Adding or correcting tests
- `build`: Changes to the build system or dependencies
- `ci`: Changes to CI configuration
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

## Git Hooks

### Pre-commit Hook

This hook runs automatically when you attempt to commit and:

- Runs linters and formatters on staged files
- Checks for debugging statements (console.log, etc)
- Ensures code quality before allowing the commit

### Commit-msg Hook

This hook validates your commit message format according to the conventional commits standard.

### Pre-push Hook

This hook runs before pushing to the remote repository and:

- Runs all tests
- Ensures the build completes successfully
- Prevents pushing code that doesn't pass tests or build

## Tips

- If you have both staged and unstaged changes, the `commit-staged` script will warn you and ask for confirmation
- You can pass a custom commit message to the commit-staged script: `./.husky/commit-staged.sh "fix: my custom message"`
- Use `pnpm format` to format all code files according to the project standards
