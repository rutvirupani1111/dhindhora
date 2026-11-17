import { headers } from "next/headers";
import { Gate } from "@/components/Gate";
import { Lane, type Demo } from "@/components/Lane";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function demos(): Promise<Demo[]> {
  try {
    return await db.query<Demo>(
      `select id, title, published_doc as doc, remix_count from projects
        where visibility = 'public' and featured and is_demo and deleted_at is null and hidden_at is null
        order by created_at asc limit 3`,
    );
  } catch { return []; }
}

export default async function Home() {
  const nonce = (await headers()).get("x-nonce") || undefined;
  const list = await demos();
  return (
    <>
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem("dh.gate")==="1")document.documentElement.classList.add("gate-seen")}catch(e){}` }} />
      <style>{`.gate-seen .gate{display:none}`}</style>
      <Gate />
      <Lane demos={list} />
    </>
  );
}
