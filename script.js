document.addEventListener('DOMContentLoaded', () => {
    const aboutBtn = document.getElementById('nav-about');
    const aboutDesc = document.getElementById('about-description');
    const wormholeBtn = document.getElementById('wormhole-btn');
    const wormholePanel = document.getElementById('wormhole-panel');

    // 1. Setup About toggle listener
    if (aboutBtn && aboutDesc) {
        aboutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isClosed = aboutDesc.classList.toggle('hidden');
            aboutBtn.classList.toggle('active', !isClosed);
            // Close wormhole panel and reset its button swirl if about is opened
            if (wormholePanel) wormholePanel.classList.remove('active');
            if (wormholeBtn) wormholeBtn.classList.remove('active');
        });
        
        // Prevent clicks inside the about description from closing the about view
        aboutDesc.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // 2. Setup Wormhole panel listeners
    if (wormholeBtn && wormholePanel) {
        const wormholeIcon = wormholeBtn.querySelector('.wormhole-icon');
        let currentAngle = 0;
        let isHovered = false;

        // Listen to hover states on desktop (only if device supports mouse hover pointers)
        const hasHoverSupport = window.matchMedia('(hover: hover)').matches;
        if (hasHoverSupport) {
            wormholeBtn.addEventListener('mouseenter', () => { isHovered = true; });
            wormholeBtn.addEventListener('mouseleave', () => { isHovered = false; });
        }

        function animateWormhole() {
            // Speed in degrees per frame
            let speed = 0.15; // Slow resting speed

            if (wormholePanel.classList.contains('active')) {
                speed = 2.4; // Very fast speed while open
            } else if (isHovered) {
                speed = 2.4; // Very fast speed on hover
            }

            currentAngle = (currentAngle + speed) % 360;
            if (wormholeIcon) {
                wormholeIcon.style.transform = `rotate(${currentAngle}deg)`;
            }

            requestAnimationFrame(animateWormhole);
        }

        // Start requestAnimationFrame loop
        animateWormhole();

        wormholeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isActive = wormholePanel.classList.toggle('active');
            // Continuously swirl the button while the panel is active
            if (isActive) {
                wormholeBtn.classList.add('active');
            } else {
                wormholeBtn.classList.remove('active');
            }
            // Close about description if wormhole is opened
            if (aboutDesc) {
                aboutDesc.classList.add('hidden');
                if (aboutBtn) aboutBtn.classList.remove('active');
            }
        });
    }

    // Close open views on click outside
    document.addEventListener('click', (e) => {
        if (aboutDesc && aboutBtn && !aboutDesc.contains(e.target) && !aboutBtn.contains(e.target)) {
            aboutDesc.classList.add('hidden');
            aboutBtn.classList.remove('active');
        }
        if (wormholePanel && wormholeBtn && !wormholePanel.contains(e.target) && !wormholeBtn.contains(e.target)) {
            wormholePanel.classList.remove('active');
            wormholeBtn.classList.remove('active');
        }
    });

    // 3. Fetch and render data
    fetch('data.json?v=4')
        .then(response => response.json())
        .then(data => {
            renderAbout(data.about);
            renderProjects(data.projects);
            renderWormhole(data.wormhole);
            initializeCarousels();
        })
        .catch(err => console.error("Error loading portfolio data:", err));

    // 4. Prevent zoom on desktop (trackpad pinch + keyboard shortcuts)
    // Disable trackpad pinch-to-zoom (macOS and Windows trackpads)
    document.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });

    // Disable Safari double-finger pinch-to-zoom gesture
    document.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    });

    // Disable keyboard shortcuts for zoom (Cmd/Ctrl + plus/minus/0)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '-' || e.key === '+' || e.key === '0')) {
            e.preventDefault();
        }
    });
});

function parseMarkdownLinks(text) {
    if (!text) return '';
    // Converts markdown-style links like [Click Here](www.link.com) into HTML anchor tags.
    // If the URL doesn't have http:// or https://, it automatically prepends https:// so it isn't relative.
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        let href = url.trim();
        if (!/^https?:\/\//i.test(href)) {
            href = 'https://' + href;
        }
        return `<a href="${href}" target="_blank">${label}</a>`;
    });
}

function renderAbout(about) {
    const aboutText = document.getElementById('about-text');
    const aboutLinks = document.getElementById('about-links');
    if (aboutText) aboutText.innerHTML = parseMarkdownLinks(about.description);
    
    if (aboutLinks && about.links) {
        aboutLinks.innerHTML = '';
        about.links.forEach(link => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = link.url;
            a.textContent = link.label;
            a.target = "_blank";
            li.appendChild(a);
            aboutLinks.appendChild(li);
        });
    }
}

function renderWormhole(writings) {
    const container = document.getElementById('wormhole-writings-list');
    const button = document.getElementById('wormhole-btn');
    if (!container) return;
    container.innerHTML = '';

    // If there are no writings, hide the wormhole button
    if (!writings || writings.length === 0) {
        if (button) button.style.display = 'none';
        return;
    }
    
    if (button) button.style.display = 'flex'; // Ensure button is shown if there are writings

    writings.forEach(writing => {
        const card = document.createElement('div');
        card.className = 'writing-card';

        // Generate a beautiful random light pastel HSL color for high text readability
        const hue = Math.floor(Math.random() * 360);
        const saturation = 55 + Math.floor(Math.random() * 15); // 55% - 70%
        const lightness = 88 + Math.floor(Math.random() * 6);   // 88% - 94%
        card.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

        // Set all inner card paddings to exactly 0.5rem
        card.style.padding = '0.5rem';

        // Randomly make some cards span the entire width of the container (15% chance if there are multiple writings)
        const shouldSpanFullWidth = writings.length > 2 && Math.random() < 0.15;
        if (shouldSpanFullWidth) {
            card.style.columnSpan = 'all';
            card.style.marginBottom = '0.5rem';
        } else {
            card.style.columnSpan = 'none';
            card.style.marginBottom = '0.5rem';
        }

        // Meta header (index + date)
        const meta = document.createElement('div');
        meta.className = 'writing-meta';

        const index = document.createElement('span');
        index.className = 'writing-index';
        index.textContent = `#${writing.index}`;

        const date = document.createElement('span');
        date.className = 'writing-date';
        date.textContent = writing.date;

        meta.appendChild(index);
        meta.appendChild(date);
        card.appendChild(meta);

        // Text Content (parsed for markdown links)
        const text = document.createElement('div');
        text.className = 'writing-text';
        text.innerHTML = parseMarkdownLinks(writing.content);
        card.appendChild(text);

        // Dynamically style any embedded images inside the card to make their sizes organic
        const img = card.querySelector('img');
        if (img) {
            // Randomize image width (e.g. between 70% and 100%)
            const randomWidth = 70 + Math.floor(Math.random() * 31); // 70% to 100%
            img.style.width = `${randomWidth}%`;
            // Randomly align images (left, center, or right) for an eclectic layout
            const alignVal = Math.random();
            if (alignVal < 0.33) {
                img.style.marginLeft = '0';
                img.style.marginRight = 'auto';
            } else if (alignVal < 0.66) {
                img.style.marginLeft = 'auto';
                img.style.marginRight = 'auto';
            } else {
                img.style.marginLeft = 'auto';
                img.style.marginRight = '0';
            }
        }

        container.appendChild(card);
    });
}

function renderProjects(projects) {
    const container = document.getElementById('projects-container');
    if (!container) return;
    container.innerHTML = '';

    projects.forEach(project => {
        const section = document.createElement('section');
        section.className = 'project-section';

        // Carousel Container
        const carouselContainer = document.createElement('div');
        carouselContainer.className = 'carousel-container';

        // Track
        const track = document.createElement('div');
        track.className = 'carousel-track';

        project.assets.forEach(asset => {
            const item = document.createElement('div');
            item.className = 'carousel-item';

            if (asset.type === 'video') {
                const video = document.createElement('video');
                video.src = asset.src;
                video.loop = true;
                video.muted = true;
                video.setAttribute('playsinline', '');
                video.setAttribute('controlsList', 'nodownload');
                video.oncontextmenu = (e) => e.preventDefault();
                item.appendChild(video);
            } else if (asset.type === 'audio') {
                const audioContainer = document.createElement('div');
                audioContainer.className = 'audio-container';

                const audio = document.createElement('audio');
                audio.controls = true;
                audio.preload = 'metadata';
                audio.setAttribute('playsinline', '');
                audio.setAttribute('controlsList', 'nodownload');
                audio.oncontextmenu = (e) => e.preventDefault();

                // Create source element to specify audio type explicitly (crucial for .m4a / audio/mp4 on Safari & Chrome)
                const source = document.createElement('source');
                source.src = asset.src;
                if (asset.src.endsWith('.m4a')) {
                    source.type = 'audio/mp4';
                } else if (asset.src.endsWith('.mp3')) {
                    source.type = 'audio/mpeg';
                } else if (asset.src.endsWith('.wav')) {
                    source.type = 'audio/wav';
                } else if (asset.src.endsWith('.ogg')) {
                    source.type = 'audio/ogg';
                }
                audio.appendChild(source);
                audioContainer.appendChild(audio);
                item.appendChild(audioContainer);

                // CRITICAL: Stop click events from bubbling up to the carousel navigation click listener
                // AND allow clicking anywhere on the container to play/pause the audio.
                audioContainer.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (e.target !== audio) {
                        if (audio.paused) {
                            audio.play().catch(err => console.error('Audio playback failed:', err));
                        } else {
                            audio.pause();
                        }
                    }
                });
            } else {
                const img = document.createElement('img');
                img.src = asset.src;
                img.alt = asset.alt || '';
                item.appendChild(img);
            }
            track.appendChild(item);
        });

        carouselContainer.appendChild(track);

        // Fullscreen button
        const fsBtn = document.createElement('button');
        fsBtn.className = 'fullscreen-btn hidden';
        fsBtn.textContent = 'Full screen';
        carouselContainer.appendChild(fsBtn);

        section.appendChild(carouselContainer);

        // Project Info
        const info = document.createElement('div');
        info.className = 'project-info';

        const infoLeft = document.createElement('div');
        infoLeft.className = 'info-left';

        const navRow = document.createElement('div');
        navRow.className = 'carousel-nav-row';

        const navNumbers = document.createElement('div');
        navNumbers.className = 'carousel-nav-numbers';

        navRow.appendChild(navNumbers);
        infoLeft.appendChild(navRow);

        const title = document.createElement('h2');
        title.className = 'project-title';
        title.textContent = project.title;
        infoLeft.appendChild(title);

        const desc = document.createElement('p');
        desc.className = 'project-description';
        desc.innerHTML = parseMarkdownLinks(project.description);
        infoLeft.appendChild(desc);

        info.appendChild(infoLeft);
        section.appendChild(info);

        container.appendChild(section);
    });
}

function initializeCarousels() {
    const projectSections = document.querySelectorAll('.project-section');

    projectSections.forEach((section) => {
        const container = section.querySelector('.carousel-container');
        const track = section.querySelector('.carousel-track');
        const items = section.querySelectorAll('.carousel-item');
        const navNumbersContainer = section.querySelector('.carousel-nav-numbers');
        const fullscreenBtn = section.querySelector('.fullscreen-btn');

        if (!track || items.length === 0 || !container) return;

        const totalItems = items.length;
        let activeIndex = 0;

        // Initialize active class on the first slide
        items[0].classList.add('active');

        // Dynamically generate thumbnail pagination buttons directly above the project title
        if (navNumbersContainer) {
            navNumbersContainer.innerHTML = ''; // Ensure container is clean
            if (totalItems > 1) {
                for (let i = 0; i < totalItems; i++) {
                    const btn = document.createElement('button');
                    btn.className = 'nav-thumb-btn';
                    if (i === 0) btn.classList.add('active');

                    // Assign a persistent random color for this thumbnail's inactive background
                    const hue = Math.floor(Math.random() * 360);
                    btn.style.backgroundColor = `hsl(${hue}, 70%, 65%)`;

                    const item = items[i];
                    const img = item.querySelector('img');
                    const video = item.querySelector('video');
                    const audio = item.querySelector('audio');

                    if (img) {
                        const thumbImg = document.createElement('img');
                        thumbImg.src = img.getAttribute('src');
                        thumbImg.alt = img.getAttribute('alt') || `Slide ${i + 1}`;
                        btn.appendChild(thumbImg);
                    } else if (video) {
                        const thumbVideo = document.createElement('video');
                        thumbVideo.src = video.getAttribute('src');
                        thumbVideo.muted = true;
                        thumbVideo.playsInline = true;
                        thumbVideo.loop = true;
                        thumbVideo.setAttribute('preload', 'metadata');
                        btn.appendChild(thumbVideo);
                    } else if (audio) {
                        const audioIcon = document.createElement('span');
                        audioIcon.className = 'thumb-audio-icon';
                        audioIcon.textContent = '🎵';
                        btn.appendChild(audioIcon);
                    }

                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        goToSlide(i);
                    });
                    navNumbersContainer.appendChild(btn);
                }
            }
        }

        // Helper to retrieve the natural aspect ratio of the active asset
        const getAssetAspectRatio = (item) => {
            const img = item.querySelector('img');
            if (img) {
                if (img.naturalWidth && img.naturalHeight) {
                    return img.naturalWidth / img.naturalHeight;
                }
                return null;
            }
            const video = item.querySelector('video');
            if (video) {
                if (video.videoWidth && video.videoHeight) {
                    return video.videoWidth / video.videoHeight;
                }
                return null;
            }
            const audio = item.querySelector('audio');
            if (audio) {
                return 2.5; // Sweet widescreen aspect ratio for audio player slide
            }
            return null;
        };

        // Update the container dimensions dynamically based on active slide ratio, screen size, and bounds
        const updateCarouselDimensions = () => {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const isMobile = viewportWidth <= 768;

            let finalWidth, finalHeight;

            if (isMobile) {
                // Mobile View: Stable constant specific size based on the first slide's aspect ratio
                const firstItem = items[0];
                const firstRatio = getAssetAspectRatio(firstItem) || 1.5; // fallback to 1.5 ratio initially

                const maxWidth = viewportWidth - 16;
                const maxAllowedHeight = viewportHeight * 0.75; // 75vh equivalent height

                // Stable full width on mobile
                finalWidth = maxWidth;

                // Stable height based on first slide ratio, capped at 75vh
                finalHeight = Math.min(maxWidth / firstRatio, maxAllowedHeight);
            } else {
                // Desktop View: Dynamic sizing based on active slide's aspect ratio
                const activeItem = items[activeIndex];
                const activeRatio = getAssetAspectRatio(activeItem) || 1.5; // fallback to 1.5 ratio initially

                const maxWidth = viewportWidth - 16;
                const maxAllowedHeight = viewportHeight * 0.75; // 75vh equivalent height

                const proposedWidth = maxAllowedHeight * activeRatio;

                if (proposedWidth > maxWidth) {
                    // Width is the constraint: shrink to fit max width and scale height down proportionally
                    finalWidth = maxWidth;
                    finalHeight = maxWidth / activeRatio;
                } else {
                    // Height is the constraint: scale width up based on maximum 75vh height
                    finalWidth = proposedWidth;
                    finalHeight = maxAllowedHeight;
                }
            }

            container.style.width = `${finalWidth}px`;
            container.style.height = `${finalHeight}px`;
            section.style.width = `calc(${finalWidth}px + 1rem)`;
        };

        // Update active number highlighting and manage video play/pause states
        const updateCarouselState = () => {
            // Update active state of thumbnail pagination buttons
            if (navNumbersContainer) {
                const thumbBtns = navNumbersContainer.querySelectorAll('.nav-thumb-btn');
                thumbBtns.forEach((btn, index) => {
                    if (index === activeIndex) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }

            // Show or hide the fullscreen button based on whether the active item has a video
            if (fullscreenBtn) {
                const activeItem = items[activeIndex];
                const hasVideo = activeItem.querySelector('video');
                if (hasVideo) {
                    fullscreenBtn.classList.remove('hidden');
                } else {
                    fullscreenBtn.classList.add('hidden');
                }
            }

            // Handle video & audio playback
            items.forEach((item, index) => {
                const video = item.querySelector('video');
                if (video) {
                    if (index === activeIndex) {
                        if (video.paused) {
                            video.play().catch((err) => {
                                console.warn("Video autoplay failed or was blocked:", err);
                            });
                        }
                    } else {
                        if (!video.paused) {
                            video.pause();
                        }
                    }
                }
                const audio = item.querySelector('audio');
                if (audio) {
                    if (index !== activeIndex) {
                        if (!audio.paused) {
                            audio.pause();
                        }
                    }
                }
            });
        };

        const goToSlide = (targetIndex) => {
            const newIndex = (targetIndex + totalItems) % totalItems;

            items[activeIndex].classList.remove('active');
            activeIndex = newIndex;
            items[activeIndex].classList.add('active');

            updateCarouselDimensions();
            updateCarouselState();
        };

        // Bind image load and video metadata load events to ensure dynamic widths update instantly upon load
        items.forEach((item, index) => {
            const img = item.querySelector('img');
            if (img) {
                img.addEventListener('load', () => {
                    if (index === activeIndex) {
                        updateCarouselDimensions();
                    }
                });
                if (img.complete) {
                    if (index === activeIndex) {
                        updateCarouselDimensions();
                    }
                }
            }

            const video = item.querySelector('video');
            if (video) {
                video.addEventListener('loadedmetadata', () => {
                    if (index === activeIndex) {
                        updateCarouselDimensions();
                    }
                });
            }
        });

        // Initial setup execution
        updateCarouselDimensions();
        updateCarouselState();

        // Listen to window resize events to keep the dimensions perfectly responsive
        window.addEventListener('resize', updateCarouselDimensions);

        // Bind fullscreen button actions
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const activeItem = items[activeIndex];
                const video = activeItem.querySelector('video');
                if (video) {
                    if (video.requestFullscreen) {
                        video.requestFullscreen();
                    } else if (video.webkitEnterFullscreen) {
                        video.webkitEnterFullscreen();
                    } else if (video.webkitRequestFullscreen) {
                        video.webkitRequestFullscreen();
                    } else if (video.mozRequestFullScreen) {
                        video.mozRequestFullScreen();
                    } else if (video.msRequestFullscreen) {
                        video.msRequestFullscreen();
                    }
                }
            });
        }

        // Hook up direct click navigation: left half goes back, right half goes forward
        items.forEach((item) => {
            // Update cursor on hover to show left/right arrow indicator
            if (!item.querySelector('audio')) {
                item.addEventListener('mousemove', (event) => {
                    const rect = item.getBoundingClientRect();
                    const mouseX = event.clientX - rect.left;
                    const width = rect.width;
                    if (mouseX < width / 2) {
                        item.style.cursor = 'w-resize';
                    } else {
                        item.style.cursor = 'e-resize';
                    }
                });
            }

            item.addEventListener('click', (event) => {
                // If this item contains an audio player, completely skip direct click navigation
                if (item.querySelector('audio')) {
                    return;
                }
                const rect = item.getBoundingClientRect();
                const clickX = event.clientX - rect.left;
                const width = rect.width;

                if (clickX < width / 2) {
                    goToSlide(activeIndex - 1);
                } else {
                    goToSlide(activeIndex + 1);
                }
            });
        });

        // Swipe support for mobile devices
        let touchStartX = 0;
        let touchEndX = 0;

        track.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        track.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const threshold = 50;
            const diff = touchEndX - touchStartX;

            if (Math.abs(diff) > threshold) {
                if (diff < 0) {
                    goToSlide(activeIndex + 1);
                } else {
                    goToSlide(activeIndex - 1);
                }
            }
        }, { passive: true });
    });
}
