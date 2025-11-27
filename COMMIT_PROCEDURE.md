# Commit Procedure

This document describes the standard commit procedure for this project.

## When to Use

Execute this procedure whenever the user requests "commit proceedure" or "commit procedure".

## Steps

### 1. Run Unit Tests
```bash
npm test
```
- Ensure all tests pass
- If tests fail, stop and inform the user

### 2. Check Test Coverage
- Review recent changes to identify new functionality
- Verify that new features have corresponding unit tests
- If new features lack tests, inform the user and ask if they want to add tests before committing

### 3. Type Check
```bash
npm run type-check
```
- Ensures no TypeScript errors that would break Vercel build
- If type errors are found, fix them before proceeding

### 4. Update README
Review and update `README.md` if:
- New features were added (add to Features section)
- Known issues were fixed (remove from Known Issues)
- Dependencies changed
- Usage instructions need updates
- Build/deployment process changed

### 5. Commit and Sync
After all checks pass:
```bash
git add -A
git commit -m "Descriptive commit message"
git push
```

Create a descriptive commit message that:
- Summarizes the main changes
- Mentions key features/fixes
- Is clear and concise

## Important Notes

- **Never skip steps** - Each step is important for code quality
- **Stop on errors** - If any step fails, inform the user before proceeding
- **Ask for confirmation** - If tests are missing or there are issues, ask the user how to proceed
