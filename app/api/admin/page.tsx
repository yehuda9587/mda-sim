const pauseVercelProject = async () => {
  if (!confirm("זה יעצור את האתר לחלוטין. בטוח?")) return;
  
  const res = await fetch('/api/admin/pause-project', { method: 'POST' });
  if (res.ok) alert("הפרויקט הופסק.");
  else alert("שגיאה בעצירת הפרויקט.");
};

// בתוך ה-Return:
<button 
  onClick={pauseVercelProject}
  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold"
>
  עצור פרויקט (חירום) ⚠️
</button>
