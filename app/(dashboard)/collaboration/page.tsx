"use client";

import { useState } from "react";
import { Activity, Check, MessageCircle, Shield, UserPlus, Users } from "lucide-react";

type Role = "admin" | "editor" | "viewer";
type Member = { id: string; name: string; email: string; role: Role };

const roleHelp: Record<Role, string> = { admin: "Manage members, projects, and workspace settings", editor: "Edit and publish shared projects", viewer: "Review projects and leave comments" };
const initialMembers: Member[] = [
  { id: "member-1", name: "You", email: "owner@example.com", role: "admin" },
  { id: "member-2", name: "Maya Chen", email: "maya@example.com", role: "editor" },
  { id: "member-3", name: "Jordan Lee", email: "jordan@example.com", role: "viewer" },
];

export default function CollaborationPage() {
  const [workspace, setWorkspace] = useState("Creator Studio");
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(["Can we bring the hook in earlier?", "The captions are ready for review."]);

  const invite = () => { if (!email.trim()) return; setMembers((current) => [...current, { id: `member-${Date.now()}`, name: email.split("@")[0], email, role: "viewer" }]); setEmail(""); };
  const updateRole = (id: string, role: Role) => setMembers((current) => current.map((member) => member.id === id ? { ...member, role } : member));
  const addComment = () => { if (!comment.trim()) return; setComments((current) => [...current, comment.trim()]); setComment(""); };

  return (
    <div className="dashboard-main mx-auto w-full max-w-[1200px] space-y-8 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Team workspace</p><h1 className="mt-2 text-3xl font-extrabold text-white">Collaboration</h1><p className="mt-2 text-sm text-white/55">Keep access, review, and project conversations in one place.</p></div><input value={workspace} onChange={(event) => setWorkspace(event.target.value)} aria-label="Workspace name" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white" /></div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="mb-5 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold text-white"><Users className="h-5 w-5 text-brand" />Members</h2><span className="text-xs text-white/45">{members.length} people</span></div><div className="mb-5 flex gap-2"><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address to invite" type="email" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" /><button onClick={invite} className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-black"><UserPlus className="h-4 w-4" />Invite</button></div><div className="space-y-3">{members.map((member) => <div key={member.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">{member.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{member.name}</p><p className="truncate text-xs text-white/45">{member.email}</p></div><select value={member.role} onChange={(event) => updateRole(member.id, event.target.value as Role)} disabled={member.name === "You"} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs capitalize text-white">{(["admin", "editor", "viewer"] as Role[]).map((role) => <option key={role}>{role}</option>)}</select></div>)}</div></section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h2 className="mb-4 flex items-center gap-2 font-bold text-white"><Shield className="h-5 w-5 text-brand" />Role permissions</h2><div className="space-y-3">{(["admin", "editor", "viewer"] as Role[]).map((role) => <div key={role} className="rounded-lg bg-white/[0.03] p-3"><p className="text-sm font-semibold capitalize text-white">{role}</p><p className="mt-1 text-xs text-white/50">{roleHelp[role]}</p></div>)}</div></section>
      </div>
      <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h2 className="mb-4 flex items-center gap-2 font-bold text-white"><MessageCircle className="h-5 w-5 text-brand" />Clip comments</h2><div className="space-y-2">{comments.map((item, index) => <div key={`${item}-${index}`} className="rounded-lg bg-white/[0.03] p-3 text-sm text-white/75">{item}<div className="mt-2 text-[11px] text-white/35">{index === comments.length - 1 ? "Just now" : "Maya Chen · 12m ago"}</div></div>)}</div><div className="mt-4 flex gap-2"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Leave a comment on this clip" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" /><button onClick={addComment} aria-label="Add comment" className="rounded-lg bg-brand px-3 text-black"><Check className="h-4 w-4" /></button></div></section><section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h2 className="mb-4 flex items-center gap-2 font-bold text-white"><Activity className="h-5 w-5 text-brand" />Activity feed</h2><div className="space-y-4 text-sm text-white/65"><p><strong className="text-white">Maya Chen</strong> updated captions on Product Launch Keynote <span className="block text-xs text-white/35">12 minutes ago</span></p><p><strong className="text-white">Jordan Lee</strong> commented on Podcast Episode #42 <span className="block text-xs text-white/35">28 minutes ago</span></p><p><strong className="text-white">You</strong> shared Tutorial Series Intro with the workspace <span className="block text-xs text-white/35">1 hour ago</span></p></div></section></div>
    </div>
  );
}
