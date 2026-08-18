(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const lessonHost = document.querySelector('[data-lesson-detail]');
  const courseHost = document.querySelector('[data-course-detail]');
  if (!lessonHost && !courseHost) return;

  let sb;
  let workspace;
  let lessonBusy = false;
  let courseBusy = false;

  const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function init(){
    try{
      const response = await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'}});
      if(!response.ok) return;
      const cfg = await response.json();
      sb = window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      const {data:ws} = await sb.from('workspaces').select('id').eq('slug',cfg.workspaceSlug || 'yamilet-mes').maybeSingle();
      workspace = ws || null;
      observe();
      await enhanceLesson();
      await enhanceCourseResources();
    }catch(error){console.warn('Yamilet private media',error);}
  }

  async function resolveCurrentLessonId(){
    const direct = lessonHost?.querySelector('[data-toggle-complete]')?.dataset.toggleComplete;
    if(direct) return direct;
    const title = lessonHost?.querySelector('.lesson-title h2')?.textContent?.trim();
    const courseTitle = lessonHost?.querySelector('.lesson-breadcrumb span:first-child')?.textContent?.trim();
    if(!title || !courseTitle || !workspace) return null;
    const {data:course} = await sb.from('courses').select('id').eq('workspace_id',workspace.id).eq('title',courseTitle).maybeSingle();
    if(!course) return null;
    const {data:mods} = await sb.from('modules').select('id').eq('course_id',course.id);
    const ids = (mods || []).map(m=>m.id);
    if(!ids.length) return null;
    const {data:lesson} = await sb.from('lessons').select('id').in('module_id',ids).eq('title',title).limit(1).maybeSingle();
    return lesson?.id || null;
  }

  async function enhanceLesson(){
    if(!sb || !lessonHost || lessonBusy || lessonHost.closest('.hidden')) return;
    lessonBusy = true;
    try{
      const lessonId = await resolveCurrentLessonId();
      if(!lessonId) return;
      if(lessonHost.querySelector(`[data-private-media-for="${lessonId}"]`)) return;
      lessonHost.querySelectorAll('[data-private-media-for]').forEach(el=>el.remove());
      const {data:lesson,error} = await sb.from('lessons').select('media_path,media_bucket,media_mime_type,media_filename').eq('id',lessonId).maybeSingle();
      if(error || !lesson?.media_path) return;
      const {data:signed,error:signError} = await sb.storage.from(lesson.media_bucket || 'lesson-media').createSignedUrl(lesson.media_path,3600);
      if(signError || !signed?.signedUrl) return;

      const mime = String(lesson.media_mime_type || '').toLowerCase();
      let html = '';
      if(mime.startsWith('video/')) html = `<video class="lesson-video" controls preload="metadata" src="${esc(signed.signedUrl)}"></video>`;
      else if(mime.startsWith('audio/')) html = `<audio controls preload="metadata" src="${esc(signed.signedUrl)}"></audio>`;
      else if(mime.startsWith('image/')) html = `<img src="${esc(signed.signedUrl)}" alt="${esc(lesson.media_filename || 'Recurso visual de la lección')}">`;
      else html = `<div class="private-media-file"><div><strong>${esc(lesson.media_filename || 'Archivo de la lección')}</strong><small>Contenido privado de Academia Yamilet</small></div><a class="btn outline" href="${esc(signed.signedUrl)}" target="_blank" rel="noopener noreferrer">Abrir archivo</a></div>`;
      const wrapper = document.createElement('div');
      wrapper.className = 'private-media';
      wrapper.dataset.privateMediaFor = lessonId;
      wrapper.innerHTML = html;
      const content = lessonHost.querySelector('.lesson-content');
      if(content) content.before(wrapper); else lessonHost.append(wrapper);
    }finally{lessonBusy=false;}
  }

  async function resolveCurrentCourseId(){
    const direct = courseHost?.querySelector('[data-course-id]')?.dataset.courseId;
    if(direct) return direct;
    const title = courseHost?.querySelector('.course-detail-head h2')?.textContent?.trim();
    if(!title || !workspace) return null;
    const {data:course} = await sb.from('courses').select('id').eq('workspace_id',workspace.id).eq('title',title).maybeSingle();
    return course?.id || null;
  }

  async function enhanceCourseResources(){
    if(!sb || !courseHost || courseBusy || courseHost.closest('.hidden')) return;
    courseBusy = true;
    try{
      const courseId = await resolveCurrentCourseId();
      if(!courseId) return;
      const existing = courseHost.querySelector(`[data-private-resources-for="${courseId}"]`);
      if(existing) return;
      courseHost.querySelectorAll('[data-private-resources-for]').forEach(el=>el.remove());
      const {data,error} = await sb.from('resources').select('id,title,description,resource_type,file_path,external_url,lesson_id,position').eq('course_id',courseId).order('position').order('created_at');
      if(error || !data?.length) return;
      const panel = document.createElement('section');
      panel.className = 'student-resources';
      panel.dataset.privateResourcesFor = courseId;
      panel.innerHTML = `<div class="eyebrow">Material complementario</div><h3>Recursos del curso</h3><div class="student-resource-list">${data.map(r=>`<button class="student-resource" type="button" data-student-resource="${r.id}"><span><strong>${esc(r.title)}</strong><small>${esc(r.description || r.resource_type || 'Recurso')}</small></span><span>Abrir →</span></button>`).join('')}</div>`;
      courseHost.append(panel);
      panel.querySelectorAll('[data-student-resource]').forEach(btn=>btn.addEventListener('click',()=>openResource(data.find(r=>r.id===btn.dataset.studentResource))));
    }finally{courseBusy=false;}
  }

  async function openResource(resource){
    if(!resource) return;
    if(resource.external_url){window.open(resource.external_url,'_blank','noopener,noreferrer');return;}
    if(!resource.file_path) return;
    const {data,error} = await sb.storage.from('digital-products').createSignedUrl(resource.file_path,900);
    if(!error && data?.signedUrl) window.open(data.signedUrl,'_blank','noopener,noreferrer');
  }

  function observe(){
    if(lessonHost){
      new MutationObserver(()=>{setTimeout(enhanceLesson,30);}).observe(lessonHost,{childList:true,subtree:true});
    }
    if(courseHost){
      new MutationObserver(()=>{setTimeout(enhanceCourseResources,30);}).observe(courseHost,{childList:true,subtree:true});
    }
  }

  window.addEventListener('load',init,{once:true});
})();
