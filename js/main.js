document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');
  const scrollTopBtn = document.getElementById('scrollTop');
  const contactForm = document.getElementById('contactForm');
  const formFeedback = document.getElementById('formFeedback');

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  });

  menuToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    menuToggle.classList.toggle('active');
    menuToggle.setAttribute('aria-expanded', isOpen);
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuToggle.classList.remove('active');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  fetch('/api/public/practice')
    .then((res) => (res.ok ? res.json() : null))
    .then((practice) => {
      if (!practice) return;
      const emailLink = document.getElementById('practiceEmail');
      if (emailLink && practice.email) {
        emailLink.href = `mailto:${practice.email}`;
        emailLink.textContent = practice.email;
      }
      const hoursEl = document.getElementById('practiceHours');
      if (hoursEl && practice.hours) hoursEl.textContent = practice.hours;
    })
    .catch(() => {});

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formFeedback.className = 'form-feedback';

    const nome = contactForm.nome.value.trim();
    const email = contactForm.email.value.trim();
    const whatsapp = contactForm.whatsapp.value.trim();
    const mensagem = contactForm.mensagem.value.trim();

    if (!nome || !email || !whatsapp || !mensagem) {
      formFeedback.textContent = 'Por favor, preencha todos os campos obrigatórios.';
      formFeedback.classList.add('error');
      return;
    }

    const submitBtn = contactForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, whatsapp, mensagem }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível enviar a mensagem.');
      }
      formFeedback.textContent = data.message || 'Mensagem enviada. Retorno em até 24 horas.';
      formFeedback.classList.add('success');
      contactForm.reset();
    } catch (err) {
      formFeedback.textContent = err.message || 'Não foi possível enviar agora. Fale pelo WhatsApp.';
      formFeedback.classList.add('error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  /* Google reviews carousel */
  const carousel = document.querySelector('[data-reviews-carousel]');
  if (carousel) {
    const track = carousel.querySelector('[data-reviews-track]');
    const prevBtn = carousel.querySelector('[data-reviews-prev]');
    const nextBtn = carousel.querySelector('[data-reviews-next]');
    const cards = Array.from(track.children);
    let index = 0;

    const getPerView = () => {
      if (window.innerWidth <= 768) return 1;
      if (window.innerWidth <= 1024) return 2;
      if (window.innerWidth <= 1100) return 3;
      return 4;
    };

    const update = () => {
      const perView = getPerView();
      const maxIndex = Math.max(0, cards.length - perView);
      if (index > maxIndex) index = maxIndex;

      const cardWidth = cards[0].getBoundingClientRect().width;
      const gap = parseFloat(getComputedStyle(track).gap) || 0;
      track.style.transform = `translateX(-${index * (cardWidth + gap)}px)`;

      prevBtn.disabled = index <= 0;
      nextBtn.disabled = index >= maxIndex;
    };

    prevBtn.addEventListener('click', () => {
      index = Math.max(0, index - 1);
      update();
    });

    nextBtn.addEventListener('click', () => {
      const perView = getPerView();
      const maxIndex = Math.max(0, cards.length - perView);
      index = Math.min(maxIndex, index + 1);
      update();
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(update, 120);
    });

    update();
  }
});
