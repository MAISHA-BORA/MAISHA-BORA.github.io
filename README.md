# Maisha Bora Youth Foundation Website

**Empowering Youth, Transforming Futures**

This is the official Jekyll website for Maisha Bora Youth Foundation, a comprehensive youth development organization serving teenagers in Karatu District, Mang'ola County, Tanzania.

## About the Organization

Maisha Bora Youth Foundation provides holistic programs that nurture teenagers' spiritual, social, and economic development. We serve youth aged 13-20, reaching approximately 25 teenagers per month and 300 per year.

### Mission
To provide comprehensive programs and resources that nurture teenagers' spiritual, social, and economic development, enabling them to pursue meaningful and fulfilling lives.

### Vision
A community where teenagers are holistically empowered to lead purposeful and fulfilling lives.

## Website Structure

### Pages

- **Home (`index.html`)** - Main landing page with overview of programs and mission
- **About (`about.html`)** - Comprehensive information about the organization, programs, and impact
- **Events (`events.html`)** - Calendar of weekly programs, monthly workshops, and special events
- **Contact (`contact.html`)** - Contact information, office hours, and ways to reach us
- **Donate (`donate.html`)** - Ways to support the organization financially and through other means
- **Blog (`blog.html`)** - Blog listing page for news and updates

### Blog Posts

Blog posts are located in `_posts/` directory following Jekyll's naming convention:
`YYYY-MM-DD-title.markdown`

## Running the Site Locally

### Prerequisites

- Ruby (version 2.5 or higher)
- Bundler gem
- Jekyll gem

### Installation

```bash
# Install dependencies
bundle install

# Serve the site locally
bundle exec jekyll serve

# View the site at http://localhost:4000
```

### Development

```bash
# Build the site
bundle exec jekyll build

# Serve with drafts
bundle exec jekyll serve --drafts

# Serve with live reload
bundle exec jekyll serve --livereload
```

## Customization

### Site Configuration

Edit `_config.yml` to update:
- Site title and description
- Contact email
- Social media usernames
- Theme settings

### Adding New Pages

Create a new markdown file with front matter:

```markdown
---
layout: page
title: Page Title
permalink: /page-url/
---

Your content here...
```

### Adding Blog Posts

Create a new file in `_posts/` directory:

```markdown
---
layout: post
title: "Your Post Title"
date: YYYY-MM-DD HH:MM:SS +0300
categories: category1 category2
---

Your post content...
```

## Theme

This site uses the **Minima** theme, which is the default Jekyll theme. It's clean, responsive, and easy to customize.

## Contact

**Maisha Bora Youth Foundation**  
Mang'ola County, Karatu District  
Arusha Region, Tanzania

**Email:** info@maishabora.org  
**Website:** [To be deployed]

**Social Media:**
- Facebook: @maishabora
- Instagram: @maishabora

## License

Content © 2025 Maisha Bora Youth Foundation. All rights reserved.

## Deployment

This site can be deployed to:
- **GitHub Pages** - Free hosting for Jekyll sites
- **Netlify** - Continuous deployment from Git
- **Traditional hosting** - Build locally and upload to web server

### GitHub Pages Deployment

1. Push code to GitHub repository
2. Enable GitHub Pages in repository settings
3. Select source branch (usually `main` or `gh-pages`)
4. Site will be available at `https://username.github.io/repository-name`

## Support

For technical issues with the website, please contact the web administrator.

For information about the organization, programs, or donations, visit [Contact Us](/contact/).

---

**Maisha Bora** - We mean "Better Life"

*Transforming lives, one teenager at a time.*
