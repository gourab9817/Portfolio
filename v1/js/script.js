const cadre = document.querySelector('.cadre');
const hoverEffect = document.querySelector('.hover-effect');

cadre.addEventListener('mousemove', (event) => {
    const rect = cadre.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    hoverEffect.style.transform = `translate(${x - 50}px, ${y - 50}px)`;
});

cadre.addEventListener('mouseleave', () => {
    hoverEffect.style.transform = 'translate(-150%, -150%)';
});

const boxes = document.querySelectorAll('.box');

const checkScroll = () => {
    boxes.forEach((box) => {
        const boxPosition = box.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;

        if (boxPosition < windowHeight - 100) {
            box.classList.add('visible');
        } else {
            box.classList.remove('visible');
        }
    });
};

window.addEventListener('scroll', checkScroll);
checkScroll();

const header = document.querySelector('header');
const heroSection = document.querySelector('#hero');

function checkHeaderScroll() {
    const heroHeight = heroSection.offsetHeight;
    if (window.scrollY === 0) {
        header.classList.remove('sticky');
        header.classList.remove('sticky-return');
    } else {
        if (window.scrollY >= heroHeight) {
            header.classList.add('sticky');
            header.classList.remove('sticky-return');
        } else {
            header.classList.remove('sticky');
            header.classList.add('sticky-return');
        }
    }
}

window.addEventListener('scroll', checkHeaderScroll);
checkHeaderScroll();

const links = document.querySelectorAll('.navbar_item_link'); 
const sections = document.querySelectorAll('section');

function highlightLinkOnScroll() {
    const scrollPosition = window.scrollY;

    sections.forEach((section, index) => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;

        if (scrollPosition >= sectionTop - 100 && scrollPosition < sectionTop + sectionHeight - 100) {
            links.forEach(link => link.classList.remove('active'));
            links.forEach(link => {
                if (link.getAttribute('href') === `#${section.id}`) {
                    link.classList.add('active'); 
                }
            });
        }
    });
}

window.addEventListener('scroll', highlightLinkOnScroll);
highlightLinkOnScroll();

const bluePulse1 = document.querySelector("#blue-pulse-1");

function animateBluePulse1() {
    const startX1 = 83, startY1 = 320, startX2 = 83, startY2 = 415;
    const targetX1 = 400, targetY1 = 83, targetX2 = 350, targetY2 = 133.75;

    const duration = 2200;
    const delay = 500;
    const repeatDelay = 1400;
    let step = 0;
    const steps = 110;

    function updateGradient() {
        if (step <= steps) {
            const x1 = startX1 + (targetX1 - startX1) * (step / steps);
            const y1 = startY1 + (targetY1 - startY1) * (step / steps);
            const x2 = startX2 + (targetX2 - startX2) * (step / steps);
            const y2 = startY2 + (targetY2 - startY2) * (step / steps);

            bluePulse1.setAttribute("x1", x1);
            bluePulse1.setAttribute("y1", y1);
            bluePulse1.setAttribute("x2", x2);
            bluePulse1.setAttribute("y2", y2);

            step++;

            requestAnimationFrame(updateGradient);
        } else {
            setTimeout(animateBluePulse1, repeatDelay);
        }
    }

    setTimeout(updateGradient, delay);
}

animateBluePulse1();


const bluePulse2 = document.querySelector("#blue-pulse-2");

function animateBluePulse2() {
    const startX1 = 83, startY1 = 267.5, startX2 = 83, startY2 = 415;
    const targetX1 = 400, targetY1 = 83, targetX2 = 350, targetY2 = 133.75;

    const duration = 2200;
    const delay = 500;
    const repeatDelay = 1400;
    let step = 0;
    const steps = 160;

    function updateGradient() {
        if (step <= steps) {
            const x1 = startX1 + (targetX1 - startX1) * (step / steps);
            const y1 = startY1 + (targetY1 - startY1) * (step / steps);
            const x2 = startX2 + (targetX2 - startX2) * (step / steps);
            const y2 = startY2 + (targetY2 - startY2) * (step / steps);

            bluePulse2.setAttribute("x1", x1);
            bluePulse2.setAttribute("y1", y1);
            bluePulse2.setAttribute("x2", x2);
            bluePulse2.setAttribute("y2", y2);

            step++;

            requestAnimationFrame(updateGradient);
        } else {
            setTimeout(animateBluePulse2, repeatDelay);
        }
    }

    setTimeout(updateGradient, delay);
}

animateBluePulse2();


const pinkPulse1 = document.querySelector("#pink-pulse-1");

function animatePinkPulse1() {
    const startX1 = 412, startY1 = 264, startX2 = 412, startY2 = 304;
    const targetX1 = 400, targetY1 = 83, targetX2 = 350, targetY2 = 133.75;

    const duration = 2200;
    const delay = 500;
    const repeatDelay = 1400;
    let step = 0;
    const steps = 50;

    function updateGradient() {
        if (step <= steps) {
            const x1 = startX1 + (targetX1 - startX1) * (step / steps);
            const y1 = startY1 + (targetY1 - startY1) * (step / steps);
            const x2 = startX2 + (targetX2 - startX2) * (step / steps);
            const y2 = startY2 + (targetY2 - startY2) * (step / steps);

            pinkPulse1.setAttribute("x1", x1);
            pinkPulse1.setAttribute("y1", y1);
            pinkPulse1.setAttribute("x2", x2);
            pinkPulse1.setAttribute("y2", y2);

            step++;

            requestAnimationFrame(updateGradient);
        } else {
            setTimeout(animatePinkPulse1, repeatDelay);
        }
    }

    setTimeout(updateGradient, delay);
}

animatePinkPulse1();


const pinkGradient2 = document.querySelector("#pink-pulse-2");

function animatePinkPulse2() {
    const startX1 = 490, startX2 = 490, startY1 = 266, startY2 = 284;
    const targetX1 = 479, targetX2 = 479, targetY1 = 120, targetY2 = 150;

    const duration = 2200;
    const delay = 500;
    const repeatDelay = 1800;
    let step = 0;
    const steps = 110;

    function updateGradient() {
        if (step <= steps) {
            const x1 = startX1 + (targetX1 - startX1) * (step / steps);
            const y1 = startY1 + (targetY1 - startY1) * (step / steps);
            const x2 = startX2 + (targetX2 - startX2) * (step / steps);
            const y2 = startY2 + (targetY2 - startY2) * (step / steps);

            pinkGradient2.setAttribute("x1", x1);
            pinkGradient2.setAttribute("y1", y1);
            pinkGradient2.setAttribute("x2", x2);
            pinkGradient2.setAttribute("y2", y2);

            step++;

            requestAnimationFrame(updateGradient);
        } else {
            setTimeout(animatePinkPulse2, repeatDelay);
        }
    }

    setTimeout(updateGradient, delay);
}

animatePinkPulse2();

const orangePulse1 = document.querySelector("#orange-pulse-1");

function animateOrangePulse1() {
    const startX1 = 826, startY1 = 270, startX2 = 826, startY2 = 340;
    const targetX1 = 360, targetY1 = 130, targetX2 = 400, targetY2 = 170;

    const duration = 2200;
    const delay = 500;
    const repeatDelay = 1800;
    let step = 0;
    const steps = 105;

    function updateGradient() {
        if (step <= steps) {
            const x1 = startX1 + (targetX1 - startX1) * (step / steps);
            const y1 = startY1 + (targetY1 - startY1) * (step / steps);
            const x2 = startX2 + (targetX2 - startX2) * (step / steps);
            const y2 = startY2 + (targetY2 - startY2) * (step / steps);

            orangePulse1.setAttribute("x1", x1);
            orangePulse1.setAttribute("y1", y1);
            orangePulse1.setAttribute("x2", x2);
            orangePulse1.setAttribute("y2", y2);

            step++;

            requestAnimationFrame(updateGradient);
        } else {
            setTimeout(animateOrangePulse1, repeatDelay);
        }
    }

    setTimeout(updateGradient, delay);
}

animateOrangePulse1();

const orangePulse2 = document.querySelector("#orange-pulse-2");

function animateOrangePulse2() {
    const startX1 = 868, startY1 = 280, startX2 = 868, startY2 = 440;
    const targetX1 = 300, targetY1 = 140, targetX2 = 400, targetY2 = 180;

    const duration = 2200;
    const delay = 500;
    const repeatDelay = 1800;
    let step = 0;
    const steps = 170;

    function updateGradient() {
        if (step <= steps) {
            const x1 = startX1 + (targetX1 - startX1) * (step / steps);
            const y1 = startY1 + (targetY1 - startY1) * (step / steps);
            const x2 = startX2 + (targetX2 - startX2) * (step / steps);
            const y2 = startY2 + (targetY2 - startY2) * (step / steps);

            orangePulse2.setAttribute("x1", x1);
            orangePulse2.setAttribute("y1", y1);
            orangePulse2.setAttribute("x2", x2);
            orangePulse2.setAttribute("y2", y2);

            step++;

            requestAnimationFrame(updateGradient);
        } else {
            setTimeout(animateOrangePulse2, repeatDelay);
        }
    }

    setTimeout(updateGradient, delay);
}

animateOrangePulse2();

window.addEventListener("scroll", function () {
    const gradientLine = document.querySelector(".gradient-line");
    const scrollPosition = window.scrollY;

    const maxHeight = 700;
    const offset = 1950;

    const newHeight = Math.max(0, Math.min(scrollPosition - offset, maxHeight));
    gradientLine.style.height = newHeight + "px";
});

window.addEventListener("scroll", function () {
    const gradientLine = document.querySelector(".gradient-line-gop");
    const scrollPosition = window.scrollY;

    const maxHeight = 740;
    const offset = 2750;

    const newHeight = Math.max(0, Math.min(scrollPosition - offset, maxHeight));
    gradientLine.style.height = newHeight + "px";
});

window.addEventListener("scroll", function () {
    const gradientLine = document.querySelector(".gradient-line-hammad");
    const scrollPosition = window.scrollY;

    const maxHeight = 740;
    const offset = 3600;

    const newHeight = Math.max(0, Math.min(scrollPosition - offset, maxHeight));
    gradientLine.style.height = newHeight + "px";
});

window.addEventListener("scroll", function () {
    const gradientLine = document.querySelector(".gradient-line-jorf");
    const scrollPosition = window.scrollY;

    const maxHeight = 600;
    const offset = 4450;

    const newHeight = Math.max(0, Math.min(scrollPosition - offset, maxHeight));
    gradientLine.style.height = newHeight + "px";
});


const experienceCadres = document.querySelectorAll('.experience_cadre');

experienceCadres.forEach((experienceCadre) => {
    const backDiv = experienceCadre.querySelector('.back');

    experienceCadre.addEventListener('mousemove', (e) => {
        const { clientX: mouseX, clientY: mouseY } = e;
        const { left, top, width, height } = experienceCadre.getBoundingClientRect();

        const centerX = left + width / 1.1;
        const centerY = top + height / 1.1;
        const deltaX = (mouseX - centerX) / width * 2;
        const deltaY = (mouseY - centerY) / height * 2;

        experienceCadre.style.transform =
            `perspective(1400px) rotateX(${deltaY}deg) rotateY(${deltaX}deg)`;

        if (backDiv) {
            const x = mouseX - left;
            const y = mouseY - top;
            backDiv.style.transform = `translate(${x - 50}px, ${y - 50}px)`;
        }
    });

    experienceCadre.addEventListener('mouseleave', () => {
        experienceCadre.style.transform = '';
        if (backDiv) {
            backDiv.style.transform = 'translate(-150%, -150%)';
        }
    });
});


function toggleSkills(button) {
    const buttons = document.querySelectorAll('.skills_category button');
    buttons.forEach((btn) => btn.classList.remove('active'));

    button.classList.add('active');

    const category = button.getAttribute('data-category');

    const skills = document.querySelectorAll('.skill');
    skills.forEach((skill) => {
        if (skill.classList.contains(`not-${category}`)) {
            skill.style.opacity = '0.3';
        } else {
            skill.style.opacity = '1';
        }
    });
}

document.querySelectorAll('.navbar_item_link').forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

function toggleMenu(button) {
    const menu = document.querySelector('.menu-items');
    const icon = button.querySelector('i');

    if (menu.classList.contains('show')) {
        menu.classList.remove('show');
        icon.classList.remove('fa-xmark');
        button.classList.remove('active');
        icon.classList.add('fa-bars');
    } else {
        menu.classList.add('show');
        icon.classList.remove('fa-bars');
        button.classList.add('active');
        icon.classList.add('fa-xmark');
    }
}



























// Cosmic Particle Cursor with reliable trail effect on both hover and click
const a = document.createElement('div');
a.className = 'c-wrap';
document.body.appendChild(a);

const b = document.createElement('div');
b.className = 'c-core';
a.appendChild(b);

// Cosmic rays - smaller size
const n = 16;
const p = [];

for (let i = 0; i < n; i++) {
  const q = document.createElement('div');
  q.className = 'c-ray';
  q.style.setProperty('--a', `${(i * 360) / n}deg`);
  q.style.setProperty('--c', ['#3CCF91', '#a881af', '#e3d99f'][i % 3]); // Green, purple, gold
  a.appendChild(q);
  p.push(q);
}

// Single orbital ring
const r = document.createElement('div');
r.className = 'c-orbit';
a.appendChild(r);

// Create container for trail particles
const tc = document.createElement('div');
tc.className = 'trail-container';
document.body.appendChild(tc);

// Variables
let x = 0, y = 0, X = 0, Y = 0, D = false;
let lastX = 0, lastY = 0;
let trailCount = 0;

// Particle colors
const C = ['#3CCF91', '#a881af', '#e3d99f', '#5e7ce2', '#e25e7c', '#e2c45e'];

// Interval to create trail particles when dragging
let trailInterval = null;

// Create trail particles - MODIFIED to work on hover
function createTrail() {
  // Removed the D check to allow trail on normal hover: if (!D) return;
  
  // Distance moved since last particle
  const dist = Math.hypot(x - lastX, y - lastY);
  if (dist < 5) return; // Don't create particles if barely moved
  
  lastX = x;
  lastY = y;
  
  // Create different number of particles based on drag vs hover
  // More particles when dragging, fewer when just hovering
  const particleCount = D ? (2 + Math.floor(Math.random() * 2)) : (1 + Math.floor(Math.random() * 2));
  
  for (let i = 0; i < particleCount; i++) {
    const c = document.createElement('div');
    c.className = 'c-particle';
    
    // Position with slight random offset
    c.style.left = `${x + (Math.random() * 10 - 5)}px`;
    c.style.top = `${y + (Math.random() * 10 - 5)}px`;
    
    // Random color from palette
    c.style.backgroundColor = C[Math.floor(Math.random() * C.length)];
    
    // Random size between 3-7px
    const size = 3 + Math.random() * 4;
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;
    
    // Append to container
    tc.appendChild(c);
    
    // Remove after delay
    setTimeout(() => {
      c.remove();
    }, 800 + Math.random() * 500);
  }
}

// Event listeners
document.addEventListener('mousemove', e => {
  x = e.clientX;
  y = e.clientY;
  
  // Create trail on all movement, not just when dragging
  createTrail();
});

document.addEventListener('mousedown', () => {
  D = true;
  a.classList.add('z');
  lastX = x;
  lastY = y;
  
  // Start trail interval - create particles even during slow drags
  trailInterval = setInterval(createTrail, 50);
  
  // Click effect
  const w = document.createElement('div');
  w.className = 'c-click';
  w.style.left = `${x}px`;
  w.style.top = `${y}px`;
  document.body.appendChild(w);
  
  setTimeout(() => w.remove(), 700);
});

document.addEventListener('mouseup', () => {
  D = false;
  a.classList.remove('z');
  
  // Clear trail interval
  if (trailInterval) {
    clearInterval(trailInterval);
    trailInterval = null;
  }
});

// Interactive elements 
const E = document.querySelectorAll('a, button, input, select, textarea, [role="button"]');
E.forEach(e => {
  e.addEventListener('mouseenter', () => {
    a.classList.add('h');
  });
  
  e.addEventListener('mouseleave', () => {
    a.classList.remove('h');
  });
});

// Animation loop
function U() {
  // Smooth following
  X += (x - X) * 0.2;
  Y += (y - Y) * 0.2;
  
  // Position cursor
  a.style.transform = `translate(${X}px, ${Y}px)`;
  
  // Update rays
  p.forEach((q, i) => {
    const d = 35; // Smaller fixed size
    q.style.setProperty('--d', `${d}px`);
    
    // Small flutter
    const j = Math.sin(Date.now() / 1000 + i * 0.5) * 3;
    q.style.setProperty('--j', `${j}px`);
  });
  
  requestAnimationFrame(U);
}

U();

// Disable default cursor
document.body.style.cursor = 'none';















// project section - Fixed and improved version
document.addEventListener('DOMContentLoaded', function() {
    const projectCategories = document.querySelectorAll('.project-category');
    
    projectCategories.forEach((category) => {
        const projectList = category.querySelector('.project-list');
        const scrollLeftBtn = category.querySelector('.scroll-left');
        const scrollRightBtn = category.querySelector('.scroll-right');
        const scrollDots = category.querySelectorAll('.scroll-dot');
        const cards = projectList.querySelectorAll('.project-card');
        
        // Staggered reveal on first paint
        cards.forEach((card, i) => {
            card.classList.add('reveal');
            setTimeout(() => card.classList.add('show'), 120 * i);
        });

        // 3D tilt effect with throttling
        cards.forEach((card) => {
            let rect;
            let ticking = false;
            
            function setTilt(e) {
                if (!ticking) {
                    requestAnimationFrame(() => {
                        rect = rect || card.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        const rx = ((y / rect.height) - 0.5) * -8;
                        const ry = ((x / rect.width) - 0.5) * 8;
                        card.style.setProperty('--rx', rx + 'deg');
                        card.style.setProperty('--ry', ry + 'deg');
                        card.classList.add('tilted');
                        ticking = false;
                    });
                    ticking = true;
                }
            }
            
            function resetTilt() {
                card.classList.remove('tilted');
                card.style.removeProperty('--rx');
                card.style.removeProperty('--ry');
                rect = undefined;
            }
            
            card.addEventListener('mousemove', setTilt, { passive: true });
            card.addEventListener('mouseleave', resetTilt);
        });
        
        // Improved scroll management
        let isScrolling = false;
        let scrollTimeout;
        let currentIndex = 0;
        
        // Debounced scroll handler
        function handleScroll() {
            if (scrollTimeout) clearTimeout(scrollTimeout);
            
            scrollTimeout = setTimeout(() => {
                updateScrollIndicator();
                isScrolling = false;
            }, 100);
        }
        
        // Update scroll indicators without causing loops
        function updateScrollIndicator() {
            if (!projectList || projectList.scrollWidth <= projectList.clientWidth) return;
            
            const maxScrollLeft = projectList.scrollWidth - projectList.clientWidth;
            const scrollPercentage = Math.max(0, Math.min(1, projectList.scrollLeft / maxScrollLeft));
            const totalCards = cards.length;
            const cardsPerView = Math.max(1, Math.floor(projectList.clientWidth / (cards[0]?.offsetWidth + 20)));
            const totalPositions = Math.ceil(totalCards / cardsPerView);
            
            // Update current index
            const cardWidth = cards[0]?.offsetWidth + 20 || 320;
            currentIndex = Math.round(projectList.scrollLeft / cardWidth);
            
            // Update dots
            const activeDotIndex = Math.min(
                Math.floor(scrollPercentage * totalPositions),
                scrollDots.length - 1
            );
            
            scrollDots.forEach((dot, index) => {
                dot.classList.toggle('active', index === activeDotIndex);
            });
            
            // Update button visibility
            if (scrollLeftBtn) {
                scrollLeftBtn.style.visibility = projectList.scrollLeft <= 10 ? 'hidden' : 'visible';
            }
            
            if (scrollRightBtn) {
                scrollRightBtn.style.visibility = 
                    projectList.scrollLeft >= maxScrollLeft - 10 ? 'hidden' : 'visible';
            }
        }
        
        // Smooth scroll to card
        function scrollToCard(index) {
            if (isScrolling) return;
        
            const totalCards = cards.length;
            if (index < 0) index = 0;
            if (index >= totalCards) index = totalCards - 1;
            
            currentIndex = index;
            isScrolling = true;
            
            const cardWidth = cards[0]?.offsetWidth + 20 || 320;
            const targetScroll = index * cardWidth;
            
            projectList.scrollTo({
                left: targetScroll,
                behavior: 'smooth'
            });
            
            // Reset scrolling flag after animation
            setTimeout(() => {
                isScrolling = false;
            }, 500);
        }
        
        // Button event listeners
        if (scrollLeftBtn) {
            scrollLeftBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const cardsPerView = Math.max(1, Math.floor(projectList.clientWidth / (cards[0]?.offsetWidth + 20)));
                scrollToCard(currentIndex - cardsPerView);
            });
        }
        
        if (scrollRightBtn) {
            scrollRightBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const cardsPerView = Math.max(1, Math.floor(projectList.clientWidth / (cards[0]?.offsetWidth + 20)));
                scrollToCard(currentIndex + cardsPerView);
            });
        }
        
        // Dot click handlers
        scrollDots.forEach((dot, index) => {
            dot.addEventListener('click', function(e) {
                e.preventDefault();
                const totalCards = cards.length;
                const cardsPerDot = Math.ceil(totalCards / scrollDots.length);
                scrollToCard(index * cardsPerDot);
            });
        });
        
        // Remove wheel event listener entirely to allow normal page scrolling
        // The project list will only scroll via buttons, dots, and touch gestures
        
        // Scroll event listener with debouncing
        projectList.addEventListener('scroll', handleScroll, { passive: true });
        
        // Touch controls removed to prevent scrolling interference
        // Users can scroll horizontally using buttons and dots
        
        // Initialize
            updateScrollIndicator();
            
        // Handle resize
        let resizeTimeout;
        window.addEventListener('resize', function() {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
            updateScrollIndicator();
            }, 250);
        });
    });
});