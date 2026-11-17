import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rangoli min-h-svh grid place-items-center p-4">
      <div className="bg-kohl text-chai border-2 border-chai p-6 text-center max-w-[420px]">
        <p className="m-0 mb-4 text-[17px]">Ye dukaan band hai, ya yahan kabhi thi hi nahi.</p>
        <Link href="/" className="tin-btn">Gali mein wapas jao</Link>
      </div>
    </div>
  );
}
