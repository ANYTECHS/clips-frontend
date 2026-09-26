"use client";

import { useState } from "react";
import { CalendarDays, Clock3, Globe2, Pencil, Plus, Send, Trash2 } from "lucide-react";

type ScheduledPost = { id: string; title: string; platform: string; date: string; time: string };

const initialPosts: ScheduledPost[] = [
  { id: "post-1", title: "Product launch highlight", platform: "TikTok", date: "2026-09-28", time: "10:30" },
  { id: "post-2", title: "Podcast episode teaser", platform: "Instagram Reels", date: "2026-09-29", time: "15:00" },
];

export default function SchedulePage() {
  const [posts, setPosts] = useState(initialPosts);
  const [timezone, setTimezone] = useState("America/New_York");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", platform: "TikTok", date: "2026-09-30", time: "12:00" });

  const savePost = () => {
    if (!draft.title.trim()) return;
    if (editingId) setPosts((current) => current.map((post) => post.id === editingId ? { ...post, ...draft } : post));
    else setPosts((current) => [...current, { ...draft, id: `post-${Date.now()}` }]);
    setEditingId(null);
    setDraft({ title: "", platform: "TikTok", date: "2026-09-30", time: "12:00" });
  };

  const editPost = (post: ScheduledPost) => { setEditingId(post.id); setDraft({ title: post.title, platform: post.platform, date: post.date, time: post.time }); };

  return (
    <div className="dashboard-main mx-auto w-full max-w-[1200px] space-y-8 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Publishing queue</p><h1 className="mt-2 text-3xl font-extrabold text-white">Scheduled posts</h1><p className="mt-2 text-sm text-white/55">Plan, review, and adjust every post from one queue.</p></div><label className="flex items-center gap-2 text-sm text-white/60"><Globe2 className="h-4 w-4" /><select value={timezone} onChange={(event) => setTimezone(event.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"><option value="America/New_York">Eastern Time</option><option value="Europe/London">London</option><option value="Asia/Tokyo">Tokyo</option><option value="UTC">UTC</option></select></label></div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="mb-5 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold text-white"><CalendarDays className="h-5 w-5 text-brand" />Queue calendar</h2><span className="text-xs text-white/45">{posts.length} scheduled</span></div><div className="grid grid-cols-7 gap-2 text-center text-[11px] text-white/40">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div><div className="mt-2 grid grid-cols-7 gap-2">{Array.from({ length: 14 }, (_, index) => { const day = index + 27; const date = `2026-09-${String(day).padStart(2, "0")}`; const count = posts.filter((post) => post.date === date).length; return <div key={date} className={`min-h-20 rounded-lg border p-2 text-left ${count ? "border-brand/40 bg-brand/10" : "border-white/10 bg-white/[0.02]"}`}><span className="text-xs text-white/60">{day > 30 ? day - 30 : day}</span>{count > 0 && <span className="mt-3 block rounded bg-brand px-1 py-0.5 text-[10px] font-bold text-black">{count} post{count > 1 ? "s" : ""}</span>}</div>; })}</div></section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h2 className="mb-4 flex items-center gap-2 font-bold text-white"><Plus className="h-5 w-5 text-brand" />{editingId ? "Edit post" : "Schedule a post"}</h2><div className="space-y-3"><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Post title" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" /><select value={draft.platform} onChange={(event) => setDraft({ ...draft, platform: event.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"><option>TikTok</option><option>Instagram Reels</option><option>YouTube Shorts</option><option>X</option></select><div className="grid grid-cols-2 gap-2"><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" /><input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" /></div><button onClick={savePost} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2 text-sm font-bold text-black"><Send className="h-4 w-4" />{editingId ? "Save changes" : "Add to queue"}</button></div></section>
      </div>
      <section className="space-y-3"><h2 className="font-bold text-white">Upcoming queue</h2>{posts.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((post) => <div key={post.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="flex-1"><p className="font-semibold text-white">{post.title}</p><p className="mt-1 text-xs text-white/50">{post.platform} · {post.date} at {post.time} ({timezone})</p></div><Clock3 className="h-4 w-4 text-white/40" /><button onClick={() => editPost(post)} aria-label={`Edit ${post.title}`} className="rounded p-2 text-white/50 hover:bg-white/10 hover:text-white"><Pencil className="h-4 w-4" /></button><button onClick={() => setPosts((current) => current.filter((item) => item.id !== post.id))} aria-label={`Cancel ${post.title}`} className="rounded p-2 text-white/50 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button></div>)}</section>
    </div>
  );
}
