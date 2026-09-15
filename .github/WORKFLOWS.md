# GitHub Actions Workflows

This project includes automated GitHub Actions workflows for testing, security checks, and publishing to npm.

## 📋 Available Workflows

### 1. **Publish to npm** (`publish.yml`)

Automatically publishes the package to npm when code is merged to `main` branch.

**Triggers:**
- Push to `main` branch
- Changes to: `src/`, `bin/`, `package.json`, `package-lock.json`, or workflow file

**What it does:**
1. ✅ Checks out the repository
2. ✅ Sets up Node.js 18
3. ✅ Installs dependencies
4. ✅ Installs Playwright browsers
5. ✅ Runs the full test suite
6. ✅ Publishes to npm (if tests pass)
7. ✅ Creates a GitHub Release
8. ✅ Sends notifications

**Requirements:**
- GitHub Secret: `NPM_TOKEN` (see setup below)

---

### 2. **Tests** (`test.yml`)

Runs tests on multiple Node.js versions and operating systems.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Matrix Testing:**
- **Operating Systems:** Ubuntu, macOS, Windows
- **Node.js Versions:** 16.x, 18.x, 20.x

**What it does:**
1. ✅ Checks out the repository
2. ✅ Sets up Node.js with caching
3. ✅ Installs dependencies
4. ✅ Installs Playwright browsers
5. ✅ Runs linter (if available)
6. ✅ Runs full test suite
7. ✅ Uploads coverage reports
8. ✅ Reports results

**Coverage:**
- Automatically uploads coverage to Codecov (on Ubuntu/Node 18)

---

### 3. **Security & Code Quality** (`security.yml`)

Checks for security vulnerabilities and code quality issues.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Weekly schedule (Sundays at 00:00 UTC)

**What it does:**
1. ✅ Runs `npm audit` (moderate and production levels)
2. ✅ Checks for dependency vulnerabilities
3. ✅ Analyzes dependencies with `npm ls`
4. ✅ Checks for outdated packages
5. ✅ Reports security issues

---

## 🔧 Setup Instructions

### Step 1: Create npm Token

1. Go to https://www.npmjs.com/settings/tokens
2. Click "Create new token"
3. Select **"Automation"** token type (allows 2FA bypass for CI)
4. Copy the generated token

### Step 2: Add GitHub Secret

1. Go to your GitHub repository: https://github.com/spjoshis/gogl
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click "New repository secret"
4. **Name:** `NPM_TOKEN`
5. **Value:** Paste your npm automation token
6. Click "Add secret"

### Step 3: Enable GitHub Actions

1. Go to your repository
2. Click on **Actions** tab
3. Workflows should be automatically detected and enabled
4. You can view workflow runs here

---

## 📊 Workflow Status

Check the status of your workflows:

1. Click the **Actions** tab in your GitHub repository
2. Select a workflow to view runs
3. Click on a run to see detailed logs

### Status Badges

Add these badges to your README.md:

```markdown
[![Tests](https://github.com/spjoshis/gogl/actions/workflows/test.yml/badge.svg)](https://github.com/spjoshis/gogl/actions/workflows/test.yml)
[![Publish to npm](https://github.com/spjoshis/gogl/actions/workflows/publish.yml/badge.svg)](https://github.com/spjoshis/gogl/actions/workflows/publish.yml)
[![Security & Code Quality](https://github.com/spjoshis/gogl/actions/workflows/security.yml/badge.svg)](https://github.com/spjoshis/gogl/actions/workflows/security.yml)
```

---

## 🚀 Publishing Workflow Details

### How Automatic Publishing Works

1. **Push to main** → Workflow triggered
2. **Run tests** → Must pass to continue
3. **Install Playwright** → Browser automation
4. **Publish to npm** → Uses NPM_TOKEN secret
5. **Create Release** → GitHub release tag
6. **Notify** → Success/failure message

### Version Management

The workflow uses the version from `package.json`:

```json
{
  "name": "@spjoshis/gogl",
  "version": "1.0.0"
}
```

**To publish a new version:**

1. Update `package.json` version
2. Commit and push to main
3. Workflow automatically publishes the new version
4. GitHub Release is created with the tag

**Example commit:**
```bash
git commit -m "chore: bump version to 1.1.0"
git push origin main
```

---

## 🧪 Test Workflow Details

### Running Tests Locally vs CI

**Locally:**
```bash
npm test
```

**CI (GitHub Actions):**
- Runs on 9 different combinations (3 OS × 3 Node versions)
- Automatically installs Playwright
- Reports results for each combination

### Understanding Test Matrix Results

Each workflow run creates multiple jobs:

```
ubuntu-latest + Node 16.x ✅
ubuntu-latest + Node 18.x ✅
ubuntu-latest + Node 20.x ✅
macos-latest + Node 16.x ✅
macos-latest + Node 18.x ✅
macos-latest + Node 20.x ✅
windows-latest + Node 16.x ✅
windows-latest + Node 18.x ✅
windows-latest + Node 20.x ✅
```

All must pass for the overall workflow to succeed.

---

## 🔐 Security Workflow Details

### npm Audit Levels

- **Low:** Very minor issues
- **Moderate:** Some risk, should review
- **High:** Serious vulnerabilities
- **Critical:** Must fix immediately

The workflow checks at **moderate level** and allows failures to continue (for awareness).

### Weekly Security Scans

Runs every Sunday at midnight UTC to catch newly discovered vulnerabilities in dependencies.

---

## 🐛 Troubleshooting Workflows

### Workflow Doesn't Trigger

**Possible causes:**
- Workflow file has syntax errors
- Branch protection rules require status checks
- Workflow is disabled

**Solutions:**
1. Check workflow syntax in `.github/workflows/`
2. Enable Actions in repository settings
3. Verify branch push permissions

### Tests Fail in CI but Pass Locally

**Possible causes:**
- Different Node.js version
- Environment differences
- Missing dependencies
- Playwright browser issues

**Solutions:**
1. Check CI logs for exact error
2. Test locally with same Node version: `nvm use 18`
3. Clear cache: `npm ci` (instead of `npm install`)
4. Reinstall Playwright: `npx playwright install`

### Publishing Fails

**Possible causes:**
- Invalid npm token
- Version already published
- npm account permissions
- Network issues

**Solutions:**
1. Verify NPM_TOKEN secret is set correctly
2. Check if version in package.json already exists on npm
3. Ensure npm account has publish permissions
4. Check npm registry status

### View Workflow Logs

1. Go to **Actions** tab
2. Click on the failed workflow run
3. Click on the failed job
4. Expand any step to see full logs
5. Look for error messages

---

## 📝 Best Practices

### Commit Messages

Use semantic versioning in commits:

```bash
# Features (bump minor version)
git commit -m "feat: add new search filters"

# Bug fixes (bump patch version)
git commit -m "fix: handle special characters in queries"

# Breaking changes (bump major version)
git commit -m "feat!: change CLI syntax"
```

### Version Updates

Always update `package.json` version when releasing:

```json
{
  "version": "1.0.0"  // ← Update this
}
```

Use semantic versioning: `MAJOR.MINOR.PATCH`

### Pull Requests

1. Create PR from feature branch to `main`
2. Workflows automatically run
3. Wait for all checks to pass ✅
4. Request code review
5. Merge PR
6. Workflows publish new version automatically

### Secrets Management

**DO:**
- ✅ Keep npm token in GitHub Secrets
- ✅ Rotate token periodically
- ✅ Use Automation token type for CI
- ✅ Never commit secrets to git

**DON'T:**
- ❌ Log secrets in workflow output
- ❌ Share tokens via email/chat
- ❌ Commit `.npmrc` with tokens
- ❌ Use personal access tokens

---

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [npm Publishing Guide](https://docs.npmjs.com/cli/v8/commands/npm-publish)
- [Semantic Versioning](https://semver.org/)
- [npm Token Management](https://docs.npmjs.com/about-access-tokens)

---

## 🎯 Next Steps

1. ✅ Add NPM_TOKEN secret (see Setup Instructions)
2. ✅ Verify workflows run successfully
3. ✅ Add status badges to README.md
4. ✅ Create a new version and commit
5. ✅ Watch automatic publishing happen!

---

**Questions?** Check the workflow logs in the **Actions** tab of your GitHub repository.
