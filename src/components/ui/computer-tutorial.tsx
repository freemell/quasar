'use client';

import { useRef, useState, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Zap, Twitter, Reply, Send, CheckCircle2, Sparkles, Download, RefreshCw } from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  action: string;
  highlight?: string;
  duration?: number;
  keyboardAction?: string;
  screenContent?: React.ReactNode;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Quasar',
    description: 'Send instant BNB tips to anyone on X with just a mention',
    action: 'Click to continue',
    duration: 3000,
    screenContent: (
      <div className="h-full bg-gradient-to-b from-[#1a1d18] to-black text-[#e6e1d7] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-gradient-to-r from-[#c8b4a0] to-[#a89080] rounded-2xl flex items-center justify-center mb-6">
          <Zap className="w-10 h-10 text-[#1a1d18]" fill="#1a1d18" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Welcome to Quasar</h2>
        <p className="text-[#c8b4a0] mb-6 leading-relaxed">
          Send instant BNB tips to anyone on X with just a mention
        </p>
      </div>
    )
  },
  {
    id: 'open-x',
    title: 'Open X (Twitter)',
    description: 'Find any post you want to tip on',
    action: 'Click the X app',
    highlight: 'x-app',
    keyboardAction: 'Open X',
    screenContent: (
      <div className="h-full bg-black text-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h1 className="text-xl font-bold">X</h1>
          <div className="w-8 h-8 bg-white rounded-full"></div>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-[#1a1d18] p-4 rounded-lg border border-white/5">
            <div className="flex items-center mb-2">
              <div className="w-10 h-10 bg-[#c8b4a0] rounded-full mr-3 flex items-center justify-center">
                <Twitter className="w-5 h-5 text-[#1a1d18]" />
              </div>
              <span className="font-bold">@user1</span>
            </div>
            <p className="text-[#c8b4a0] mb-3">Just posted something amazing!</p>
            <button className="text-[#c8b4a0] hover:text-[#e6e1d7] text-sm flex items-center gap-1">
              <Reply className="w-3 h-3" />
              Reply
            </button>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'compose-reply',
    title: 'Compose Reply',
    description: 'Click the reply button to start typing',
    action: 'Click reply',
    highlight: 'reply-button',
    keyboardAction: 'Reply',
    screenContent: (
      <div className="h-full bg-black text-white flex flex-col">
        <div className="flex items-center p-4 border-b border-white/10">
          <button className="text-[#c8b4a0] mr-3">Cancel</button>
          <span className="flex-grow text-center text-lg font-bold">Reply</span>
          <button className="text-[#c8b4a0] opacity-50 flex items-center gap-1">
            <Send className="w-4 h-4" />
            Tweet
          </button>
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-start">
            <div className="w-10 h-10 bg-[#2a2e26] rounded-full mr-3"></div>
            <textarea
              className="flex-grow bg-transparent text-white placeholder-[#c8b4a0] focus:outline-none resize-none"
              placeholder="Post your reply"
              rows={4}
              value="@username "
              readOnly
            ></textarea>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'type-command',
    title: 'Type @Quasar Command',
    description: 'Type "@Quasar tip 0.5 BNB" to send a tip',
    action: 'Type the command',
    highlight: 'text-input',
    keyboardAction: '@Quasar tip 0.5 BNB',
    screenContent: (
      <div className="h-full bg-black text-white flex flex-col">
        <div className="flex items-center p-4 border-b border-white/10">
          <button className="text-[#c8b4a0] mr-3">Cancel</button>
          <span className="flex-grow text-center text-lg font-bold">Reply</span>
          <button className="text-[#c8b4a0]">Tweet</button>
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-start">
            <div className="w-10 h-10 bg-[#2a2e26] rounded-full mr-3"></div>
            <textarea
              className="flex-grow bg-transparent text-white placeholder-[#c8b4a0] focus:outline-none resize-none font-mono"
              placeholder="Post your reply"
              rows={4}
              value="@username @Quasar tip 0.5 BNB"
              readOnly
            ></textarea>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'send-tip',
    title: 'Send Your Tip',
    description: 'Press Enter or click send to submit your tip!',
    action: 'Press Enter',
    highlight: 'send-button',
    keyboardAction: 'Enter',
    screenContent: (
      <div className="h-full bg-black text-white flex flex-col">
        <div className="flex items-center p-4 border-b border-white/10">
          <button className="text-[#c8b4a0] mr-3">Cancel</button>
          <span className="flex-grow text-center text-lg font-bold">Reply</span>
          <button className="bg-[#c8b4a0] text-[#1a1d18] px-4 py-1 rounded-full text-sm font-bold">Tweet</button>
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-start">
            <div className="w-10 h-10 bg-[#2a2e26] rounded-full mr-3"></div>
            <textarea
              className="flex-grow bg-transparent text-white placeholder-[#c8b4a0] focus:outline-none resize-none font-mono"
              placeholder="Post your reply"
              rows={4}
              value="@username @Quasar tip 0.5 BNB"
              readOnly
            ></textarea>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'confirmation',
    title: 'Tip Sent!',
    description: 'The recipient gets notified and can claim their BNB',
    action: 'View transaction',
    highlight: 'confirmation',
    duration: 3000,
    screenContent: (
      <div className="h-full bg-gradient-to-b from-[#6b5545] to-[#1a1d18] text-[#e6e1d7] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-[#c8b4a0] rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-12 h-12 text-[#1a1d18]" fill="#1a1d18" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Tip Sent Successfully!</h3>
        <p className="text-[#c8b4a0] text-sm">Tx: 0x123...abc</p>
        <p className="text-[#a89080] text-xs mt-4">Check your dashboard for details.</p>
      </div>
    )
  },
  {
    id: 'features',
    title: 'Powerful Features',
    description: 'Everything you need to tip, donate, and reward on X',
    action: 'Explore features',
    duration: 5000,
    screenContent: (
      <div className="h-full bg-gradient-to-b from-[#1a1d18] to-black text-[#e6e1d7] p-4 overflow-y-auto">
        <h3 className="text-xl font-bold mb-4 text-center">Powerful Features</h3>
        <div className="space-y-3">
          {[
            { icon: Zap, title: 'Instant Tips', desc: 'Send BNB instantly' },
            { icon: Sparkles, title: 'Auto-Pay', desc: 'Set up automatic rules' },
            { icon: CheckCircle2, title: 'Zero Fees', desc: 'Only network fees' },
            { icon: Download, title: 'x402 Integration', desc: 'Micropayments' },
            { icon: Send, title: 'Smart Giveaways', desc: 'Pick winners automatically' },
            { icon: RefreshCw, title: 'Custodial Wallets', desc: 'Auto-create for recipients' }
          ].map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div key={index} className="bg-white/5 p-3 rounded-lg border border-white/5">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-[#6b5545]/20 rounded-lg flex items-center justify-center mr-3">
                    <IconComponent className="w-4 h-4 text-[#c8b4a0]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{feature.title}</div>
                    <div className="text-xs text-[#c8b4a0]">{feature.desc}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )
  }
];

export default function ComputerTutorial() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const descriptionRef = useRef<HTMLParagraphElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const keyboardRef = useRef<HTMLDivElement | null>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  const startTutorial = () => {
    setIsPlaying(true);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsPlaying(false);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const togglePlay = () => {
    setIsPlaying(prev => !prev);
  };

  const restartTutorial = () => {
    setCurrentStep(0);
    setIsPlaying(true);
  };

  const handleKeyClick = (key: string) => {
    const step = tutorialSteps[currentStep];
    
    setActiveKeys([key]);
    setTimeout(() => setActiveKeys([]), 300);

    if (step?.id === 'send-tip' && key === 'Enter') {
      setTimeout(() => nextStep(), 500);
    } else if (step?.id === 'type-command') {
      setTimeout(() => {
        if (currentStep < tutorialSteps.length - 1) {
          nextStep();
        }
      }, 1000);
    } else if (step?.id === 'open-x' || step?.id === 'compose-reply') {
      setTimeout(() => nextStep(), 500);
    }
  };

  useEffect(() => {
    setProgress(((currentStep + 1) / tutorialSteps.length) * 100);
  }, [currentStep]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && currentStep < tutorialSteps.length - 1) {
      timer = setTimeout(() => {
        nextStep();
      }, tutorialSteps[currentStep].duration || 3000);
    } else if (isPlaying && currentStep === tutorialSteps.length - 1) {
      timer = setTimeout(() => {
        setIsPlaying(false);
      }, tutorialSteps[currentStep].duration || 3000);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep]);

  useGSAP(
    () => {
      if (!sectionRef.current) return;
      
      gsap.set(sectionRef.current, { autoAlpha: 0, y: 50, scale: 0.95 });
      
      const elements = [titleRef.current, descriptionRef.current, canvasRef.current].filter(Boolean);
      if (elements.length > 0) {
        gsap.set(elements, { autoAlpha: 0, y: 20, scale: 0.98 });
      }

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.to(sectionRef.current, { autoAlpha: 1, y: 0, scale: 1, duration: 1 });
      if (titleRef.current) {
        tl.to(titleRef.current, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.2);
      }
      if (descriptionRef.current) {
        tl.to(descriptionRef.current, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.3);
      }
      if (canvasRef.current) {
        tl.to(canvasRef.current, { autoAlpha: 1, y: 0, duration: 1, scale: 1 }, 0.4);
      }
    },
    { scope: sectionRef }
  );

  const currentStepData = tutorialSteps[currentStep];
  const step = tutorialSteps[currentStep];
  const isTyping = step?.id === 'type-command';
  const isSending = step?.id === 'send-tip';

  // Keyboard layout
  const topRow = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
  const middleRow = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
  const bottomRow = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];
  const specialKeys = [
    { key: '@', label: '@' },
    { key: 'Space', label: 'Space' },
    { key: 'Enter', label: 'Enter' },
    { key: 'Backspace', label: '⌫' }
  ];

  const getKeyStyle = (key: string) => {
    const isActive = activeKeys.includes(key);
    const shouldHighlight = (isTyping && step.keyboardAction?.includes(key)) || (isSending && key === 'Enter');
    
    return {
      backgroundColor: isActive ? '#a89080' : shouldHighlight ? '#c8b4a0' : '#2a2e26',
      color: isActive || shouldHighlight ? '#1a1d18' : '#e6e1d7',
      transform: isActive ? 'scale(0.95)' : 'scale(1)',
      transition: 'all 0.2s ease'
    };
  };

  return (
    <section id="tutorial" ref={sectionRef} className="relative py-24 bg-gradient-to-br from-[#1a1d18] via-black to-[#2a2e26]">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16">
        <div className="text-center mb-16">
          <h2 ref={titleRef} className="text-4xl md:text-5xl font-extralight text-[#e6e1d7] mb-6">
            Tutorial
          </h2>
          <p ref={descriptionRef} className="text-lg text-[#c8b4a0]/75 max-w-2xl mx-auto">
            Learn how to send BNB tips on X in seconds
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* 2D Computer Mockup */}
          <div ref={canvasRef} className="relative flex items-center justify-center">
            <div className="relative w-full max-w-2xl">
              {/* Computer Screen */}
              <div className="relative bg-[#1a1d18] rounded-t-2xl p-2 shadow-2xl">
                {/* Screen Bezel */}
                <div className="bg-black rounded-lg overflow-hidden aspect-video border-2 border-[#2a2e26]">
                  {currentStepData.screenContent}
                </div>
              </div>
              
              {/* Computer Base */}
              <div className="bg-gradient-to-b from-[#2a2e26] to-[#1a1d18] h-4 rounded-b-2xl shadow-xl"></div>
              
              {/* Keyboard */}
              <div ref={keyboardRef} className="mt-6 bg-[#1a1d18] rounded-xl p-6 border border-white/10 shadow-xl">
                {/* Top Row */}
                <div className="flex justify-center gap-1.5 mb-1.5">
                  {topRow.map((key) => (
                    <button
                      key={key}
                      onClick={() => handleKeyClick(key)}
                      className="px-3 py-2 rounded text-sm font-medium hover:scale-105 transition-transform"
                      style={getKeyStyle(key)}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                
                {/* Middle Row */}
                <div className="flex justify-center gap-1.5 mb-1.5">
                  {middleRow.map((key) => (
                    <button
                      key={key}
                      onClick={() => handleKeyClick(key)}
                      className="px-3 py-2 rounded text-sm font-medium hover:scale-105 transition-transform"
                      style={getKeyStyle(key)}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                
                {/* Bottom Row */}
                <div className="flex justify-center gap-1.5 mb-1.5">
                  {bottomRow.map((key) => (
                    <button
                      key={key}
                      onClick={() => handleKeyClick(key)}
                      className="px-3 py-2 rounded text-sm font-medium hover:scale-105 transition-transform"
                      style={getKeyStyle(key)}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                
                {/* Special Keys Row */}
                <div className="flex justify-center gap-1.5 mt-2">
                  {specialKeys.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => handleKeyClick(key)}
                      className={`px-4 py-2 rounded text-sm font-medium hover:scale-105 transition-transform ${
                        key === 'Space' ? 'px-12' : key === 'Enter' ? 'px-8' : ''
                      }`}
                      style={getKeyStyle(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tutorial Controls */}
          <div className="space-y-8">
            {/* Progress Bar */}
            <div className="space-y-4">
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-[#c8b4a0] to-[#a89080] h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-[#c8b4a0]/70">
                <span>Step {currentStep + 1} of {tutorialSteps.length}</span>
                <span>{Math.round(progress)}% Complete</span>
              </div>
            </div>

            {/* Step Content */}
            <div>
              <h3 className="text-3xl font-extralight text-[#e6e1d7] mb-4">
                {currentStepData.title}
              </h3>
              <p className="text-[#c8b4a0]/75 text-lg leading-relaxed">
                {currentStepData.description}
              </p>
              {currentStepData.keyboardAction && (
                <p className="text-[#a89080] text-sm mt-2 font-mono">
                  Click: {currentStepData.keyboardAction}
                </p>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                className="px-6 py-3 rounded-full bg-white/10 text-[#e6e1d7] hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={nextStep}
                disabled={currentStep === tutorialSteps.length - 1}
                className="px-6 py-3 rounded-full bg-[#6b5545] text-[#e6e1d7] hover:bg-[#8a7060] transition-colors"
              >
                Next Step
              </button>
              <button
                onClick={togglePlay}
                className="px-6 py-3 rounded-full bg-white/5 text-[#c8b4a0]/70 hover:bg-white/10 transition-colors"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={restartTutorial}
                className="px-6 py-3 rounded-full bg-white/5 text-[#c8b4a0]/70 hover:bg-white/10 transition-colors"
              >
                Restart
              </button>
            </div>
            <p className="text-sm text-[#c8b4a0]/50 mt-4">
              {isPlaying ? 'Tutorial is playing automatically' : 'Tutorial is paused'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
