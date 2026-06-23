# Storybook Deployment Guide

Step-by-step guide to deploy Storybook to various platforms.

## 🚀 Option 1: GitHub Pages (Recommended)

### Automatic Deployment

The repository includes a GitHub Actions workflow that automatically deploys Storybook to GitHub Pages on every push to the main branch.

#### Setup Steps

1. **Enable GitHub Pages**
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Source", select **GitHub Actions**
   - Save the settings

2. **Push Your Code**
   ```bash
   git add .
   git commit -m "Add Storybook documentation"
   git push origin main
   ```

3. **Wait for Deployment**
   - Go to **Actions** tab in your repository
   - Watch the "Deploy Storybook to GitHub Pages" workflow
   - Deployment takes ~2-3 minutes

4. **Access Your Storybook**
   - URL: `https://[username].github.io/clips-frontend/`
   - Or check the Actions workflow output for the exact URL

#### Workflow File

The workflow is located at `.github/workflows/storybook.yml`:

```yaml
name: Deploy Storybook to GitHub Pages

on:
  push:
    branches: [main, master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build-storybook
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './storybook-static'

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

### Manual Deployment

If you prefer manual deployment:

```bash
# 1. Build Storybook
npm run build-storybook

# 2. Install gh-pages
npm install --save-dev gh-pages

# 3. Add deploy script to package.json
{
  "scripts": {
    "deploy-storybook": "gh-pages -d storybook-static"
  }
}

# 4. Deploy
npm run deploy-storybook
```

---

## 🎨 Option 2: Chromatic

Chromatic provides hosting, visual testing, and UI review workflows.

### Setup Steps

1. **Sign Up**
   - Go to https://www.chromatic.com/
   - Sign in with GitHub
   - Authorize Chromatic

2. **Create Project**
   - Click "Add project"
   - Select your repository
   - Copy the project token

3. **Install Chromatic**
   ```bash
   npm install --save-dev chromatic
   ```

4. **Deploy**
   ```bash
   npx chromatic --project-token=<your-project-token>
   ```

5. **Automate with GitHub Actions**

   Create `.github/workflows/chromatic.yml`:

   ```yaml
   name: Chromatic

   on:
     push:
       branches: [main]
     pull_request:

   jobs:
     chromatic:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
           with:
             fetch-depth: 0
         - uses: actions/setup-node@v4
           with:
             node-version: '18'
         - run: npm ci
         - run: npx chromatic --project-token=${{ secrets.CHROMATIC_PROJECT_TOKEN }}
   ```

6. **Add Secret**
   - Go to repository Settings → Secrets → Actions
   - Add `CHROMATIC_PROJECT_TOKEN` with your token

### Benefits

- ✅ Visual regression testing
- ✅ UI review workflows
- ✅ Collaboration features
- ✅ Automatic snapshots
- ✅ Free for open source

---

## ☁️ Option 3: Vercel

Deploy Storybook as a static site on Vercel.

### Setup Steps

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login**
   ```bash
   vercel login
   ```

3. **Build Storybook**
   ```bash
   npm run build-storybook
   ```

4. **Deploy**
   ```bash
   vercel --prod storybook-static
   ```

### Automatic Deployment

1. **Create vercel.json**
   ```json
   {
     "buildCommand": "npm run build-storybook",
     "outputDirectory": "storybook-static",
     "framework": null
   }
   ```

2. **Connect Repository**
   - Go to https://vercel.com/
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure build settings:
     - Build Command: `npm run build-storybook`
     - Output Directory: `storybook-static`
   - Deploy

3. **Custom Domain** (Optional)
   - Go to project settings
   - Add custom domain
   - Update DNS records

---

## 🌐 Option 4: Netlify

Deploy to Netlify for free hosting.

### Setup Steps

1. **Create netlify.toml**
   ```toml
   [build]
     command = "npm run build-storybook"
     publish = "storybook-static"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

2. **Deploy via CLI**
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli

   # Login
   netlify login

   # Build
   npm run build-storybook

   # Deploy
   netlify deploy --prod --dir=storybook-static
   ```

3. **Deploy via UI**
   - Go to https://app.netlify.com/
   - Click "Add new site"
   - Import from Git
   - Configure:
     - Build command: `npm run build-storybook`
     - Publish directory: `storybook-static`
   - Deploy

---

## 📦 Option 5: AWS S3 + CloudFront

Deploy to AWS for enterprise hosting.

### Setup Steps

1. **Build Storybook**
   ```bash
   npm run build-storybook
   ```

2. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://your-storybook-bucket
   ```

3. **Upload Files**
   ```bash
   aws s3 sync storybook-static/ s3://your-storybook-bucket --delete
   ```

4. **Configure Bucket**
   ```bash
   aws s3 website s3://your-storybook-bucket \
     --index-document index.html \
     --error-document index.html
   ```

5. **Set Permissions**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-storybook-bucket/*"
       }
     ]
   }
   ```

6. **Create CloudFront Distribution** (Optional)
   - For HTTPS and CDN
   - Point to S3 bucket
   - Configure custom domain

---

## 🔒 Option 6: Private Deployment

For internal/private Storybook instances.

### Self-Hosted

```bash
# Build Storybook
npm run build-storybook

# Serve with any static server
npx http-server storybook-static -p 8080

# Or with nginx, Apache, etc.
```

### Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build-storybook

FROM nginx:alpine
COPY --from=builder /app/storybook-static /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:

```bash
docker build -t storybook .
docker run -p 8080:80 storybook
```

### Password Protection

With Vercel:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "WWW-Authenticate",
          "value": "Basic realm=\"Storybook\""
        }
      ]
    }
  ]
}
```

---

## 📊 Comparison

| Platform | Cost | Setup | Features | Best For |
|----------|------|-------|----------|----------|
| **GitHub Pages** | Free | Easy | Basic hosting | Open source |
| **Chromatic** | Free tier | Easy | Visual testing | Teams |
| **Vercel** | Free tier | Easy | Fast CDN | Production |
| **Netlify** | Free tier | Easy | Forms, functions | Full-stack |
| **AWS S3** | Pay-as-go | Medium | Scalable | Enterprise |
| **Self-hosted** | Server cost | Hard | Full control | Private |

---

## ✅ Post-Deployment Checklist

After deploying:

- [ ] Verify Storybook loads correctly
- [ ] Test all component stories
- [ ] Check interactive controls work
- [ ] Verify accessibility addon functions
- [ ] Test on mobile devices
- [ ] Check loading performance
- [ ] Update README with live URL
- [ ] Share link with team
- [ ] Set up monitoring (optional)
- [ ] Configure custom domain (optional)

---

## 🔄 Updating Deployment

### GitHub Pages

```bash
# Automatic - just push
git push origin main
```

### Chromatic

```bash
# Manual
npx chromatic --project-token=<token>

# Or push to trigger GitHub Action
git push origin main
```

### Vercel/Netlify

```bash
# Automatic - just push
git push origin main

# Or manual
vercel --prod storybook-static
# or
netlify deploy --prod --dir=storybook-static
```

---

## 🐛 Troubleshooting

### Build Fails

```bash
# Clear cache
rm -rf node_modules/.cache
rm -rf storybook-static

# Reinstall
npm install

# Try again
npm run build-storybook
```

### 404 Errors

- Check output directory is correct
- Verify index.html exists
- Check routing configuration
- Ensure all assets are included

### Slow Loading

- Enable CDN (CloudFront, Vercel Edge)
- Optimize images
- Enable compression
- Use lazy loading

### Authentication Issues

- Check repository permissions
- Verify tokens are correct
- Ensure secrets are set
- Check workflow permissions

---

## 📝 Custom Domain

### GitHub Pages

1. Add `CNAME` file to `storybook-static/`:
   ```
   storybook.yourdomain.com
   ```

2. Configure DNS:
   ```
   CNAME storybook.yourdomain.com → username.github.io
   ```

### Vercel/Netlify

1. Go to project settings
2. Add custom domain
3. Follow DNS instructions
4. Wait for SSL certificate

---

## 🎯 Recommended Setup

For ClipCash AI, we recommend:

1. **Primary**: GitHub Pages (free, automatic)
2. **Alternative**: Chromatic (visual testing)
3. **Production**: Vercel (if custom domain needed)

**Current Status**: GitHub Pages workflow configured and ready to deploy.

---

## 📧 Support

Need help?
- Check [STORYBOOK.md](./STORYBOOK.md) for general docs
- Review platform-specific documentation
- Open an issue on GitHub

---

**Last Updated**: May 26, 2026  
**Recommended**: GitHub Pages  
**Status**: Ready to deploy
