
(function(){
  const menuBtn = document.querySelector('[data-menu-btn]');
  const nav = document.querySelector('[data-nav]');
  if(menuBtn && nav){
    menuBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true':'false');
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', ()=> nav.classList.remove('open')));
  }

  document.querySelectorAll('[data-lang-switch]').forEach(link => {
    link.addEventListener('click', () => {
      try{ localStorage.setItem('yamiletLang', link.dataset.langSwitch); }catch(e){}
    });
  });

  const form = document.querySelector('[data-newsletter]');
  if(form){
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const lang = document.documentElement.lang;
      alert(lang === 'it'
        ? 'Modulo pronto per essere collegato al provider e-mail.'
        : 'Formulario listo para conectarse al proveedor de correo.');
    });
  }
})();
