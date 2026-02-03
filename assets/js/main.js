// Maisha Bora Youth Foundation - Main JavaScript

document.addEventListener('DOMContentLoaded', function() {
  
  // Mobile Menu Toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const mainNavigation = document.querySelector('.main-navigation');
  
  if (menuToggle) {
    menuToggle.addEventListener('click', function() {
      mainNavigation.classList.toggle('active');
      const isOpen = mainNavigation.classList.contains('active');
      menuToggle.innerHTML = isOpen ? '✕' : '☰';
      menuToggle.setAttribute('aria-expanded', isOpen);
    });
    
    // Close menu when clicking on a link
    const navLinks = document.querySelectorAll('.main-navigation a');
    navLinks.forEach(link => {
      link.addEventListener('click', function() {
        mainNavigation.classList.remove('active');
        menuToggle.innerHTML = '☰';
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
  
  // Header Scroll Effect
  const siteHeader = document.querySelector('.site-header');
  let lastScroll = 0;
  
  window.addEventListener('scroll', function() {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
      siteHeader.classList.add('scrolled');
    } else {
      siteHeader.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
  });
  
  // Active Navigation Link
  const currentPage = window.location.pathname;
  const navLinks = document.querySelectorAll('.main-navigation a');
  
  navLinks.forEach(link => {
    const linkPath = new URL(link.href).pathname;
    if (currentPage === linkPath || (currentPage === '/' && linkPath === '/')) {
      link.classList.add('active');
    }
  });
  
  // Smooth Scroll for Anchor Links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
  
  // Intersection Observer for Fade-in Animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  // Observe cards, sections, and gallery items
  const animatedElements = document.querySelectorAll('.card, .section, .gallery-item, .stat-item');
  animatedElements.forEach(el => observer.observe(el));
  
  // Counter Animation for Stats
  const counters = document.querySelectorAll('.stat-number');
  const animateCounter = function(counter) {
    const target = parseInt(counter.getAttribute('data-target') || counter.textContent);
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;
    
    const timer = setInterval(function() {
      current += step;
      if (current >= target) {
        counter.textContent = target.toLocaleString();
        clearInterval(timer);
      } else {
        counter.textContent = Math.floor(current).toLocaleString();
      }
    }, 16);
  };
  
  // Trigger counter animation when stat section is visible
  const statsObserver = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const counters = entry.target.querySelectorAll('.stat-number');
        counters.forEach(counter => animateCounter(counter));
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  
  const statsSection = document.querySelector('.stats-section');
  if (statsSection) {
    statsObserver.observe(statsSection);
  }
  
  // Image Gallery Lightbox
  const galleryItems = document.querySelectorAll('.gallery-item');
  
  galleryItems.forEach(item => {
    item.addEventListener('click', function() {
      const img = this.querySelector('img');
      if (img) {
        openLightbox(img.src, img.alt);
      }
    });
  });
  
  function openLightbox(src, alt) {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
      <div class="lightbox-content">
        <span class="lightbox-close">&times;</span>
        <img src="${src}" alt="${alt}">
        <p>${alt}</p>
      </div>
    `;
    
    document.body.appendChild(lightbox);
    document.body.style.overflow = 'hidden';
    
    // Add lightbox styles if not already present
    if (!document.querySelector('#lightbox-styles')) {
      const style = document.createElement('style');
      style.id = 'lightbox-styles';
      style.textContent = `
        .lightbox {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.9);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
        }
        .lightbox-content {
          position: relative;
          max-width: 90%;
          max-height: 90%;
          text-align: center;
        }
        .lightbox-content img {
          max-width: 100%;
          max-height: 80vh;
          border-radius: 5px;
        }
        .lightbox-content p {
          color: white;
          margin-top: 15px;
          font-size: 1.2rem;
        }
        .lightbox-close {
          position: absolute;
          top: -40px;
          right: 0;
          color: white;
          font-size: 3rem;
          cursor: pointer;
          transition: transform 0.3s ease;
        }
        .lightbox-close:hover {
          transform: scale(1.2);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Close lightbox
    lightbox.addEventListener('click', function(e) {
      if (e.target === lightbox || e.target.className === 'lightbox-close') {
        document.body.removeChild(lightbox);
        document.body.style.overflow = 'auto';
      }
    });
    
    // Close with Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && document.querySelector('.lightbox')) {
        const lb = document.querySelector('.lightbox');
        document.body.removeChild(lb);
        document.body.style.overflow = 'auto';
      }
    });
  }
  
  // Form Validation and Submission
  const contactForm = document.querySelector('#contact-form');
  
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      // Basic validation
      const name = contactForm.querySelector('[name="name"]');
      const email = contactForm.querySelector('[name="email"]');
      const message = contactForm.querySelector('[name="message"]');
      
      let isValid = true;
      let errorMessage = '';
      
      if (!name || name.value.trim() === '') {
        isValid = false;
        errorMessage += 'Please enter your name.\n';
      }
      
      if (!email || !isValidEmail(email.value)) {
        isValid = false;
        errorMessage += 'Please enter a valid email address.\n';
      }
      
      if (!message || message.value.trim().length < 10) {
        isValid = false;
        errorMessage += 'Please enter a message (at least 10 characters).\n';
      }
      
      if (!isValid) {
        e.preventDefault();
        alert(errorMessage);
        return false;
      }
      
      // Show loading state
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
      }
      
      // Form will be submitted to Formspree
      // Success message will be shown by Formspree or via redirect
    });
  }
  
  function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
  
  // Back to Top Button
  const backToTop = document.createElement('button');
  backToTop.className = 'back-to-top';
  backToTop.innerHTML = '↑';
  backToTop.setAttribute('aria-label', 'Back to top');
  document.body.appendChild(backToTop);
  
  // Add back to top styles
  const backToTopStyles = document.createElement('style');
  backToTopStyles.textContent = `
    .back-to-top {
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 50px;
      height: 50px;
      background-color: var(--secondary-color, #FF6F00);
      color: white;
      border: none;
      border-radius: 50%;
      font-size: 1.5rem;
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      z-index: 999;
    }
    .back-to-top.visible {
      opacity: 1;
      visibility: visible;
    }
    .back-to-top:hover {
      background-color: #E65100;
      transform: translateY(-5px);
    }
  `;
  document.head.appendChild(backToTopStyles);
  
  // Show/hide back to top button
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  });
  
  backToTop.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
  
  // Lazy Loading for Images
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver(function(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          imageObserver.unobserve(img);
        }
      });
    });
    
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => imageObserver.observe(img));
  }
  
  // Print functionality
  const printButtons = document.querySelectorAll('.print-button');
  printButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      window.print();
    });
  });
  
  // Add current year to footer
  const yearElements = document.querySelectorAll('.current-year');
  yearElements.forEach(el => {
    el.textContent = new Date().getFullYear();
  });
  
  // Console message
  console.log('%cMaisha Bora Youth Foundation', 'color: #2E7D32; font-size: 24px; font-weight: bold;');
  console.log('%cEmpowering Youth, Transforming Futures', 'color: #FF6F00; font-size: 14px;');
  console.log('Website developed with ❤️ for the youth of Tanzania');
  
});

// Service Worker Registration (for PWA capabilities - optional)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    // Uncomment to enable service worker
    // navigator.serviceWorker.register('/sw.js').then(function(registration) {
    //   console.log('ServiceWorker registration successful');
    // }).catch(function(err) {
    //   console.log('ServiceWorker registration failed: ', err);
    // });
  });
}
