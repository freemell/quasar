export default function Footer() {
  const contactAddress = '0x2c61767cecb76cb4bdfe53d8d7490ceb7aa74444';

  return (
    <footer className="w-full border-t border-white/10 bg-black/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="text-white/70 text-sm font-light">
              © {new Date().getFullYear()} Quasar. All rights reserved.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
            <div className="text-center md:text-right">
              <p className="text-white/60 text-xs font-light mb-1">Contact Address</p>
              <p className="text-white/90 font-mono text-sm">
                {contactAddress}
              </p>
            </div>

            <div className="flex gap-4">
              <a
                href="/privacy"
                className="text-white/70 hover:text-white text-sm font-light transition-colors"
              >
                Privacy
              </a>
              <span className="text-white/30">•</span>
              <a
                href="/terms"
                className="text-white/70 hover:text-white text-sm font-light transition-colors"
              >
                Terms
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
