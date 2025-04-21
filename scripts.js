// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
    // 初始化导航菜单
    initNavigation();
    
    // 初始化返回顶部按钮
    initBackToTop();
    
    // 初始化动画元素
    initAnimations();
    
    // 初始化浮动粒子效果
    initFloatingParticles();
    
    // 初始化游戏筛选功能
    initGameFilters();
});

// 导航菜单功能
function initNavigation() {
    const mobileToggle = document.querySelector('.mobile-nav-toggle');
    const navMenu = document.querySelector('nav ul');
    
    if (mobileToggle && navMenu) {
        mobileToggle.addEventListener('click', function() {
            navMenu.classList.toggle('mobile-active');
            this.textContent = navMenu.classList.contains('mobile-active') ? '✕' : '☰';
        });
    }
    
    // 页面滚动时导航栏效果
    window.addEventListener('scroll', function() {
        const header = document.querySelector('header');
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
    
    // 添加当前页面导航项的活跃状态
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('nav ul li a');
    
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href');
        if (currentPage === linkPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active');
        }
    });
}

// 返回顶部按钮功能
function initBackToTop() {
    const backToTopBtn = document.getElementById('back-to-top');
    
    if (backToTopBtn) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });
        
        backToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

// 初始化动画元素
function initAnimations() {
    // 为具有fade-in-up类的元素添加延迟动画
    const animatedElements = document.querySelectorAll('.fade-in-up');
    animatedElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.animationDelay = `${0.1 * (index % 5)}s`;
    });
    
    // 滚动时显示动画
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.classList.add('animated');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });
    
    document.querySelectorAll('.fade-in-up, .animate-on-scroll').forEach(el => {
        observer.observe(el);
    });
    
    // 添加游戏卡片悬停效果
    const gameCards = document.querySelectorAll('.game-card');
    gameCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
            this.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.1)';
            
            const img = this.querySelector('img');
            if (img) img.style.transform = 'scale(1.05)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'var(--box-shadow)';
            
            const img = this.querySelector('img');
            if (img) img.style.transform = 'scale(1)';
        });
    });
}

// 浮动粒子效果
function initFloatingParticles() {
    const particlesContainer = document.getElementById('particles-background');
    
    if (!particlesContainer) return;
    
    // 生成随机粒子
    const particleCount = window.innerWidth < 768 ? 30 : 50;
    
    for (let i = 0; i < particleCount; i++) {
        createParticle(particlesContainer);
    }
}

function createParticle(container) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    
    // 随机位置、大小和动画时长
    const size = Math.random() * 5 + 1; // 1-6px
    const posX = Math.random() * 100; // 0-100%
    const posY = Math.random() * 100; // 0-100%
    const duration = Math.random() * 20 + 10; // 10-30s
    const delay = Math.random() * 5; // 0-5s
    
    // 设置粒子样式
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${posX}%`;
    particle.style.top = `${posY}%`;
    particle.style.animation = `float ${duration}s ease-in-out ${delay}s infinite`;
    particle.style.opacity = Math.random() * 0.5 + 0.1; // 0.1-0.6
    
    // 随机颜色
    const hue = Math.random() * 360;
    particle.style.backgroundColor = `hsla(${hue}, 70%, 70%, 0.8)`;
    
    // 添加到容器
    container.appendChild(particle);
    
    // 在随机时间后更改粒子位置和动画
    setInterval(() => {
        const newX = Math.random() * 100;
        const newY = Math.random() * 100;
        const newDuration = Math.random() * 20 + 10;
        
        particle.style.left = `${newX}%`;
        particle.style.top = `${newY}%`;
        particle.style.animation = `float ${newDuration}s ease-in-out infinite`;
    }, Math.random() * 30000 + 20000); // 20-50s
}

// 游戏筛选功能
function initGameFilters() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    const gameCards = document.querySelectorAll('.game-card');
    const sortDropdown = document.querySelector('.sort-dropdown');
    
    // 初始化筛选标签
    if (filterTabs.length > 0) {
        filterTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // 移除所有标签的活跃状态
                filterTabs.forEach(t => t.classList.remove('active'));
                
                // 添加当前标签的活跃状态
                this.classList.add('active');
                
                // 获取筛选类别
                const filter = this.getAttribute('data-filter');
                
                // 筛选游戏卡片
                gameCards.forEach(card => {
                    if (filter === 'all') {
                        card.style.display = 'block';
                    } else {
                        if (card.classList.contains(filter)) {
                            card.style.display = 'block';
                        } else {
                            card.style.display = 'none';
                        }
                    }
                    
                    // 添加动画效果
                    setTimeout(() => {
                        if (card.style.display !== 'none') {
                            card.classList.add('sorting');
                            setTimeout(() => {
                                card.classList.remove('sorting');
                            }, 500);
                        }
                    }, 50);
                });
            });
        });
    }
    
    // 初始化排序下拉菜单
    if (sortDropdown) {
        const sortButton = sortDropdown.querySelector('.sort-button');
        const sortDropdownMenu = sortDropdown.querySelector('.sort-dropdown-menu');
        
        sortButton.addEventListener('click', function() {
            sortDropdown.classList.toggle('active');
        });
        
        // 点击其他地方关闭下拉菜单
        document.addEventListener('click', function(event) {
            if (!sortDropdown.contains(event.target)) {
                sortDropdown.classList.remove('active');
            }
        });
        
        // 排序选项点击事件
        const sortItems = sortDropdown.querySelectorAll('.sort-dropdown-item');
        sortItems.forEach(item => {
            item.addEventListener('click', function() {
                const sortMethod = this.getAttribute('data-sort');
                
                // 实现排序逻辑
                sortGames(sortMethod);
                
                // 更新排序按钮文本
                sortButton.querySelector('span').textContent = this.textContent;
                
                // 关闭下拉菜单
                sortDropdown.classList.remove('active');
            });
        });
    }
}

// 游戏排序功能
function sortGames(method) {
    const gameGrid = document.querySelector('.games-grid');
    if (!gameGrid) return;
    
    const gameCards = Array.from(gameGrid.children);
    
    gameCards.forEach(card => {
        card.classList.add('sorting');
    });
    
    switch (method) {
        case 'rating-high':
            gameCards.sort((a, b) => {
                const ratingA = parseFloat(a.querySelector('.rating-number')?.textContent || '0');
                const ratingB = parseFloat(b.querySelector('.rating-number')?.textContent || '0');
                return ratingB - ratingA;
            });
            break;
        case 'rating-low':
            gameCards.sort((a, b) => {
                const ratingA = parseFloat(a.querySelector('.rating-number')?.textContent || '0');
                const ratingB = parseFloat(b.querySelector('.rating-number')?.textContent || '0');
                return ratingA - ratingB;
            });
            break;
        case 'name-asc':
            gameCards.sort((a, b) => {
                const nameA = a.querySelector('h3')?.textContent || '';
                const nameB = b.querySelector('h3')?.textContent || '';
                return nameA.localeCompare(nameB);
            });
            break;
        case 'name-desc':
            gameCards.sort((a, b) => {
                const nameA = a.querySelector('h3')?.textContent || '';
                const nameB = b.querySelector('h3')?.textContent || '';
                return nameB.localeCompare(nameA);
            });
            break;
        default:
            // 默认不排序
            break;
    }
    
    // 重新排列卡片
    gameCards.forEach(card => {
        gameGrid.appendChild(card);
        
        // 添加排序动画
        setTimeout(() => {
            card.classList.remove('sorting');
        }, 500);
    });
}

// 定义浮动粒子的动画
if (!document.getElementById('float-keyframes')) {
    const style = document.createElement('style');
    style.id = 'float-keyframes';
    style.textContent = `
        @keyframes float {
            0% {
                transform: translateY(0) translateX(0) rotate(0);
            }
            33% {
                transform: translateY(-20px) translateX(20px) rotate(10deg);
            }
            66% {
                transform: translateY(10px) translateX(-15px) rotate(-5deg);
            }
            100% {
                transform: translateY(0) translateX(0) rotate(0);
            }
        }
        
        .particle {
            position: absolute;
            border-radius: 50%;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
}
