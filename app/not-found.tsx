import Link from 'next/link';
import { IconHome } from '@tabler/icons-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 px-4">
      <div className="text-center max-w-lg">
        <div className="relative inline-block mb-6">
          <span className="text-[10rem] font-bold text-transparent bg-clip-text bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 select-none leading-none">
            404
          </span>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-1.5 rounded-full bg-[#05141f]" />
        </div>

        <h1 className="text-2xl font-semibold text-slate-800 mb-2">
          Halaman Tidak Ditemukan
        </h1>
        <p className="text-slate-600 mb-10">
          Maaf, halaman yang Anda cari tidak ada atau mungkin telah dipindahkan.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/* <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 px-6 h-10 bg-[#002c5f] text-white rounded-lg font-medium hover:bg-[#003d7a] transition-colors shadow-sm"
          >
            <IconLayoutDashboardFilled size={16} className="text-slate-100 -mt-0.5" />
            <span className="text-sm font-medium text-slate-100">Ke Dashboard Admin</span>
          </Link> */}
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 h-10 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            <IconHome size={16} className="text-slate-700 -mt-0.5" />
            <span className="text-sm font-medium text-slate-700">Ke Beranda</span>
          </Link>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-400">
        KIA
      </div>
    </div>
  );
}
