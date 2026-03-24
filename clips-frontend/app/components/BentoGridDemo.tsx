"use client";

/**
 * Bento Grid Demo Component
 * Demonstrates various grid layouts and responsive behavior
 */

export default function BentoGridDemo() {
  return (
    <div className="w-full space-y-8">
      {/* Demo Section 1: Classic Bento (2/3 + 1/3) */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-4 px-4">Classic Bento Layout</h2>
        <div className="bento-grid">
          <div className="bento-item-two-thirds bento-card bento-card-medium">
            <h3 className="text-lg font-semibold text-white mb-2">Main Content (2/3)</h3>
            <p className="text-zinc-400 text-sm">
              This card spans 8 columns on desktop (66.67%), 6 columns on tablet (100%), 
              and 1 column on mobile (100%).
            </p>
          </div>
          <div className="bento-item-one-third bento-card bento-card-medium">
            <h3 className="text-lg font-semibold text-white mb-2">Sidebar (1/3)</h3>
            <p className="text-zinc-400 text-sm">
              This card spans 4 columns on desktop (33.33%), 6 columns on tablet (100%), 
              and 1 column on mobile (100%).
            </p>
          </div>
        </div>
      </section>

      {/* Demo Section 2: Three Equal Columns */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-4 px-4">Three Equal Columns</h2>
        <div className="bento-grid">
          <div className="bento-item-third bento-card bento-card-short">
            <h3 className="text-lg font-semibold text-white mb-2">Column 1</h3>
            <p className="text-zinc-400 text-sm">4 columns on desktop</p>
          </div>
          <div className="bento-item-third bento-card bento-card-short">
            <h3 className="text-lg font-semibold text-white mb-2">Column 2</h3>
            <p className="text-zinc-400 text-sm">4 columns on desktop</p>
          </div>
          <div className="bento-item-third bento-card bento-card-short">
            <h3 className="text-lg font-semibold text-white mb-2">Column 3</h3>
            <p className="text-zinc-400 text-sm">4 columns on desktop</p>
          </div>
        </div>
      </section>

      {/* Demo Section 3: Four Equal Columns */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-4 px-4">Four Equal Columns</h2>
        <div className="bento-grid">
          <div className="bento-item-quarter bento-card bento-card-short">
            <h3 className="text-lg font-semibold text-white mb-2">Q1</h3>
            <p className="text-zinc-400 text-sm">3 columns</p>
          </div>
          <div className="bento-item-quarter bento-card bento-card-short">
            <h3 className="text-lg font-semibold text-white mb-2">Q2</h3>
            <p className="text-zinc-400 text-sm">3 columns</p>
          </div>
          <div className="bento-item-quarter bento-card bento-card-short">
            <h3 className="text-lg font-semibold text-white mb-2">Q3</h3>
            <p className="text-zinc-400 text-sm">3 columns</p>
          </div>
          <div className="bento-item-quarter bento-card bento-card-short">
            <h3 className="text-lg font-semibold text-white mb-2">Q4</h3>
            <p className="text-zinc-400 text-sm">3 columns</p>
          </div>
        </div>
      </section>

      {/* Demo Section 4: Mixed Layout */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-4 px-4">Mixed Layout</h2>
        <div className="bento-grid">
          <div className="bento-item-full bento-card bento-card-short">
            <h3 className="text-lg font-semibold text-white mb-2">Full Width Header</h3>
            <p className="text-zinc-400 text-sm">12 columns (100%)</p>
          </div>
          <div className="bento-item-half bento-card bento-card-medium">
            <h3 className="text-lg font-semibold text-white mb-2">Half Width</h3>
            <p className="text-zinc-400 text-sm">6 columns (50%)</p>
          </div>
          <div className="bento-item-half bento-card bento-card-medium">
            <h3 className="text-lg font-semibold text-white mb-2">Half Width</h3>
            <p className="text-zinc-400 text-sm">6 columns (50%)</p>
          </div>
        </div>
      </section>

      {/* Responsive Info */}
      <section className="px-4">
        <div className="bento-card">
          <h3 className="text-lg font-semibold text-white mb-4">Responsive Breakpoints</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-24 text-zinc-400">Mobile:</span>
              <span className="text-white">320px - 639px (1 column, 16px gap)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-zinc-400">Tablet:</span>
              <span className="text-white">640px - 1023px (6 columns, 20px gap)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-zinc-400">Desktop:</span>
              <span className="text-white">1024px - 1439px (12 columns, 24px gap)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-zinc-400">Large:</span>
              <span className="text-white">1440px - 1919px (12 columns, 32px gap)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-zinc-400">XL:</span>
              <span className="text-white">1920px+ (12 columns, 32px gap)</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
