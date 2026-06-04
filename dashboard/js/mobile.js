/**
 * WARSTACK — Mobile Navigation Controller
 */

const sidebar            = document.getElementById('sidebar');
const overlay            = document.getElementById('sidebar-overlay');
const hamburger          = document.getElementById('mobile-hamburger');
const mobileSectionTitle = document.getElementById('mobile-section-title');
const bottomNavItems     = document.querySelectorAll('.bottom-nav-item[data-section]');
const bottomNavMore      = document.getElementById('bottom-nav-more');

function openSidebar() {
  sidebar?.classList.add('mobile-open');
  overlay?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  sidebar?.classList.remove('mobile-open');
  overlay?.classList.remove('active');
  document.body.style.overflow = '';
}

hamburger?.addEventListener('click', openSidebar);
overlay?.addEventListener('click', closeSidebar);

document.querySelectorAll('.nav-item[data-section]').forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth < 768) closeSidebar();
  });
});

bottomNavItems.forEach(btn => {
  btn.addEventListener('click', () => {
    const section = btn.dataset.section;
    const sidebarItem = document.querySelector(`.nav-item[data-section="${section}"]`);
    if (sidebarItem) sidebarItem.click();
    bottomNavItems.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

bottomNavMore?.addEventListener('click', openSidebar);

const sectionTitleEl = document.getElementById('section-title');
if (sectionTitleEl && mobileSectionTitle) {
  const observer = new MutationObserver(() => {
    mobileSectionTitle.textContent = sectionTitleEl.textContent;
  });
  observer.observe(sectionTitleEl, { childList: true, characterData: true, subtree: true });
}

const mainAvatar   = document.getElementById('user-avatar');
const mobileAvatar = document.getElementById('mobile-user-avatar');
if (mainAvatar && mobileAvatar) {
  const avatarObserver = new MutationObserver(() => {
    if (mainAvatar.src) mobileAvatar.src = mainAvatar.src;
  });
  avatarObserver.observe(mainAvatar, { attributes: true, attributeFilter: ['src'] });
}

document.addEventListener('click', (e) => {
  const navItem = e.target.closest('.nav-item[data-section]');
  if (!navItem) return;
  const section = navItem.dataset.section;
  bottomNavItems.forEach(b => {
    b.classList.toggle('active', b.dataset.section === section);
  });
});