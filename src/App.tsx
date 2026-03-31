import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  Globe, 
  Coins, 
  BarChart3, 
  RefreshCcw, 
  ExternalLink, 
  Clock,
  AlertCircle,
  Search,
  ChevronRight,
  Languages,
  Bell,
  Settings,
  X,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { toast, Toaster } from 'sonner';
import { fetchTraderNews, NewsItem, translateNewsToKhmer } from './services/newsService';
import { cn } from './lib/utils';

type Category = 'crypto' | 'stocks' | 'forex' | 'all';

interface NotificationSettings {
  enabled: boolean;
  categories: Category[];
  minImpact: 'high' | 'medium' | 'low';
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  categories: ['all'],
  minImpact: 'high'
};

export default function App() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem('traderpulse_notifications');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  
  const seenNewsIds = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem('traderpulse_notifications', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  const loadNews = useCallback(async (category: Category, isInitial = false) => {
    setIsRefreshing(true);
    const categoriesToFetch = category === 'all' ? ['crypto', 'stocks', 'forex'] : [category];
    
    try {
      const results: NewsItem[][] = [];
      for (const cat of categoriesToFetch) {
        const catNews = await fetchTraderNews(cat);
        results.push(catNews);
        // Small delay between categories to be gentle on the API/Proxy
        if (categoriesToFetch.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      const flattened = results.flat().sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Check for notifications on new items
      if (!isInitial && notificationSettings.enabled) {
        flattened.forEach(item => {
          if (!seenNewsIds.current.has(item.id)) {
            const matchesCategory = notificationSettings.categories.includes('all') || 
                                  notificationSettings.categories.includes(item.category as Category);
            
            const impactLevels = ['low', 'medium', 'high'];
            const matchesImpact = impactLevels.indexOf(item.impact) >= impactLevels.indexOf(notificationSettings.minImpact);

            if (matchesCategory && matchesImpact) {
              toast.info(`Breaking: ${item.title}`, {
                description: `${item.category.toUpperCase()} • ${item.impact.toUpperCase()} IMPACT`,
                action: item.url ? {
                  label: 'View',
                  onClick: () => window.open(item.url, '_blank')
                } : undefined,
                duration: 6000,
              });
            }
          }
        });
      }

      // Update seen IDs
      flattened.forEach(item => seenNewsIds.current.add(item.id));

      setNews(flattened);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to load news", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [notificationSettings]);

  useEffect(() => {
    loadNews('all', true);
    const interval = setInterval(() => loadNews(activeCategory), 300000); // Refresh every 5 mins
    return () => clearInterval(interval);
  }, [loadNews, activeCategory]);

  const filteredNews = activeCategory === 'all' 
    ? news 
    : news.filter(item => item.category === activeCategory);

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="h-14 border-b border-[#27272A] bg-[#0A0A0B]/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            TRADER<span className="text-blue-500">PULSE</span>
          </h1>
          <div className="hidden md:flex items-center gap-2 ml-6 px-3 py-1 bg-[#18181B] rounded-full border border-[#27272A]">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="terminal-text text-[#A1A1AA]">LIVE FEED</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-[#71717A] terminal-text">
            <Clock className="w-3 h-3" />
            <span>LAST UPDATED: {formatDistanceToNow(lastUpdated)} AGO</span>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-[#18181B] rounded-md transition-colors text-[#A1A1AA] relative"
            >
              <Bell className={cn("w-4 h-4", notificationSettings.enabled && "text-blue-500")} />
              {notificationSettings.enabled && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full border border-[#0A0A0B]" />
              )}
            </button>
            <button 
              onClick={() => loadNews(activeCategory)}
              disabled={isRefreshing}
              className={cn(
                "p-2 hover:bg-[#18181B] rounded-md transition-colors text-[#A1A1AA]",
                isRefreshing && "animate-spin"
              )}
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <Toaster 
        theme="dark" 
        position="bottom-right" 
        toastOptions={{
          className: 'bg-[#121214] border border-[#27272A] text-white',
          descriptionClassName: 'text-[#A1A1AA] text-xs',
        }}
      />

      <AnimatePresence>
        {showSettings && (
          <NotificationSettingsModal 
            settings={notificationSettings}
            onSave={setNotificationSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar Navigation */}
        <nav className="w-full md:w-64 border-r border-[#27272A] bg-[#0A0A0B] p-4 flex flex-col gap-2">
          <div className="text-[10px] font-bold text-[#52525B] uppercase tracking-widest mb-2 px-2">Market Segments</div>
          <NavButton 
            active={activeCategory === 'all'} 
            onClick={() => setActiveCategory('all')}
            icon={<Globe className="w-4 h-4" />}
            label="Global Overview"
          />
          <NavButton 
            active={activeCategory === 'crypto'} 
            onClick={() => setActiveCategory('crypto')}
            icon={<Coins className="w-4 h-4" />}
            label="Cryptocurrency"
          />
          <NavButton 
            active={activeCategory === 'stocks'} 
            onClick={() => setActiveCategory('stocks')}
            icon={<BarChart3 className="w-4 h-4" />}
            label="Stock Market"
          />
          <NavButton 
            active={activeCategory === 'forex'} 
            onClick={() => setActiveCategory('forex')}
            icon={<RefreshCcw className="w-4 h-4" />}
            label="Forex / FX"
          />

          <div className="mt-auto p-4 glass-panel bg-blue-600/5 border-blue-500/20">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Pro Tip</span>
            </div>
            <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
              High impact news often leads to volatility. Watch for volume spikes after major announcements.
            </p>
          </div>
        </nav>

        {/* Content Area */}
        <section className="flex-1 overflow-y-auto bg-[#09090B] p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {activeCategory === 'all' ? 'Market Pulse' : `${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} News`}
                </h2>
                <p className="text-[#71717A] text-sm">Aggregated real-time intelligence for active traders.</p>
              </div>
              
              <div className="relative hidden sm:block">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
                <input 
                  type="text" 
                  placeholder="Filter feed..." 
                  className="bg-[#18181B] border border-[#27272A] rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors w-64"
                />
              </div>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-32 glass-panel animate-pulse bg-[#18181B]" />
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {/* Must Know Section */}
                {filteredNews.filter(item => item.impact === 'high').length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <div className="w-1.5 h-4 bg-red-500 rounded-full" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Must Know / High Impact</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredNews
                        .filter(item => item.impact === 'high')
                        .slice(0, 4)
                        .map((item) => (
                          <NewsCard key={`must-know-${item.id}`} item={item} compact />
                        ))}
                    </div>
                    <div className="h-px bg-[#27272A] w-full my-6" />
                  </div>
                )}

                {/* Main Feed */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Latest Updates</h3>
                  </div>
                  <AnimatePresence mode="popLayout">
                    {filteredNews.length > 0 ? (
                      filteredNews
                        .filter(item => item.impact !== 'high' || !filteredNews.filter(i => i.impact === 'high').slice(0, 4).find(i => i.id === item.id))
                        .map((item) => (
                          <NewsCard key={item.id} item={item} />
                        ))
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-20 glass-panel"
                      >
                        <AlertCircle className="w-12 h-12 text-[#3F3F46] mx-auto mb-4" />
                        <h3 className="text-white font-medium">No news found</h3>
                        <p className="text-[#71717A] text-sm">Try refreshing or selecting a different category.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer / Ticker */}
      <footer className="h-10 border-t border-[#27272A] bg-[#0A0A0B] flex items-center overflow-hidden">
        <div className="bg-blue-600 h-full px-4 flex items-center text-[10px] font-bold text-white uppercase tracking-widest z-10">
          Market Ticker
        </div>
        <div className="flex-1 whitespace-nowrap animate-marquee flex items-center gap-8 terminal-text text-[#A1A1AA]">
          <TickerItem symbol="BTC/USD" price="68,432.10" change="+2.4%" up />
          <TickerItem symbol="ETH/USD" price="3,421.50" change="-1.2%" />
          <TickerItem symbol="S&P 500" price="5,241.53" change="+0.5%" up />
          <TickerItem symbol="EUR/USD" price="1.0842" change="-0.02%" />
          <TickerItem symbol="GOLD" price="2,174.20" change="+1.1%" up />
          <TickerItem symbol="TSLA" price="175.22" change="-3.4%" />
          <TickerItem symbol="NVDA" price="924.10" change="+4.2%" up />
          {/* Duplicate for seamless loop */}
          <TickerItem symbol="BTC/USD" price="68,432.10" change="+2.4%" up />
          <TickerItem symbol="ETH/USD" price="3,421.50" change="-1.2%" />
          <TickerItem symbol="S&P 500" price="5,241.53" change="+0.5%" up />
        </div>
      </footer>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md transition-all group",
        active 
          ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" 
          : "text-[#A1A1AA] hover:bg-[#18181B] hover:text-white"
      )}
    >
      <span className={cn(active ? "text-blue-400" : "text-[#52525B] group-hover:text-[#A1A1AA]")}>
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
      {active && <ChevronRight className="w-3 h-3 ml-auto" />}
    </button>
  );
}

function NewsCard({ item, compact }: { item: NewsItem, compact?: boolean }) {
  const [translated, setTranslated] = useState<{ title: string, summary: string } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (translated) {
      setTranslated(null);
      return;
    }

    setIsTranslating(true);
    try {
      const result = await translateNewsToKhmer(item.title, item.summary);
      setTranslated(result);
    } catch (error) {
      console.error("Translation failed", error);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "glass-panel hover:border-[#3F3F46] transition-all group cursor-pointer",
        compact ? "p-4 border-l-4 border-l-red-500/50" : "p-5"
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
            item.impact === 'high' ? "impact-high" : 
            item.impact === 'medium' ? "impact-medium" : "impact-low"
          )}>
            {item.impact} IMPACT
          </span>
          <span className="text-[10px] font-bold text-[#52525B] uppercase tracking-widest">
            {item.category} • {item.source}
          </span>
        </div>
        {!compact && (
          <span className="terminal-text text-[#52525B]">
            {formatDistanceToNow(new Date(item.timestamp))} ago
          </span>
        )}
      </div>

      <h3 className={cn(
        "font-bold text-white group-hover:text-blue-400 transition-colors mb-2 leading-tight",
        compact ? "text-base" : "text-lg"
      )}>
        {translated ? translated.title : item.title}
      </h3>
      
      <p className={cn(
        "text-[#A1A1AA] text-sm leading-relaxed mb-4",
        compact && "line-clamp-2"
      )}>
        {translated ? translated.summary : item.summary}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!compact && (
            <button className="text-[10px] font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1 uppercase tracking-wider">
              Analyze Impact <ChevronRight className="w-3 h-3" />
            </button>
          )}
          
          <button 
            onClick={handleTranslate}
            disabled={isTranslating}
            className={cn(
              "text-[10px] font-bold flex items-center gap-1.5 uppercase tracking-wider transition-colors",
              translated ? "text-green-500 hover:text-green-400" : "text-[#71717A] hover:text-white"
            )}
          >
            {isTranslating ? (
              <RefreshCcw className="w-3 h-3 animate-spin" />
            ) : (
              <Languages className="w-3 h-3" />
            )}
            {translated ? "Show Original" : "Translate to Khmer"}
          </button>
        </div>
        {item.url && (
          <a 
            href={item.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 bg-[#18181B] rounded hover:bg-[#27272A] transition-colors text-[#71717A]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </motion.div>
  );
}

function TickerItem({ symbol, price, change, up }: { symbol: string, price: string, change: string, up?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-bold text-white">{symbol}</span>
      <span className="text-[#E4E4E7]">{price}</span>
      <span className={cn("font-bold", up ? "text-green-500" : "text-red-500")}>
        {change}
      </span>
    </div>
  );
}

function NotificationSettingsModal({ settings, onSave, onClose }: { 
  settings: NotificationSettings, 
  onSave: (s: NotificationSettings) => void, 
  onClose: () => void 
}) {
  const [localSettings, setLocalSettings] = useState(settings);

  const toggleCategory = (cat: Category) => {
    setLocalSettings(prev => {
      if (cat === 'all') return { ...prev, categories: ['all'] };
      const newCats = prev.categories.includes(cat) 
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories.filter(c => c !== 'all'), cat];
      return { ...prev, categories: newCats.length === 0 ? ['all'] : newCats };
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#0A0A0B] border border-[#27272A] rounded-xl w-full max-w-md overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#27272A] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center text-blue-500">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Alert Settings</h3>
              <p className="text-xs text-[#71717A]">Configure breaking news notifications</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#18181B] rounded-full text-[#52525B] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Master Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium text-white">Enable Notifications</div>
              <div className="text-xs text-[#71717A]">Receive real-time market alerts</div>
            </div>
            <button 
              onClick={() => setLocalSettings(p => ({ ...p, enabled: !p.enabled }))}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative",
                localSettings.enabled ? "bg-blue-600" : "bg-[#27272A]"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                localSettings.enabled ? "left-7" : "left-1"
              )} />
            </button>
          </div>

          <div className={cn("space-y-6 transition-opacity", !localSettings.enabled && "opacity-40 pointer-events-none")}>
            {/* Markets */}
            <div className="space-y-3">
              <div className="text-[10px] font-bold text-[#52525B] uppercase tracking-widest">Market Segments</div>
              <div className="grid grid-cols-2 gap-2">
                {(['all', 'crypto', 'stocks', 'forex'] as Category[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all",
                      localSettings.categories.includes(cat)
                        ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                        : "bg-[#18181B] border-[#27272A] text-[#71717A] hover:border-[#3F3F46]"
                    )}
                  >
                    {localSettings.categories.includes(cat) && <Check className="w-3 h-3" />}
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Impact */}
            <div className="space-y-3">
              <div className="text-[10px] font-bold text-[#52525B] uppercase tracking-widest">Minimum Impact Level</div>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setLocalSettings(p => ({ ...p, minImpact: lvl }))}
                    className={cn(
                      "flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-all uppercase",
                      localSettings.minImpact === lvl
                        ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                        : "bg-[#18181B] border-[#27272A] text-[#71717A] hover:border-[#3F3F46]"
                    )}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#52525B] italic">
                You will only be notified for news with {localSettings.minImpact} impact or higher.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-[#121214] border-t border-[#27272A] flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium text-[#A1A1AA] hover:bg-[#18181B] transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onSave(localSettings);
              onClose();
              toast.success('Settings updated successfully');
            }}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
