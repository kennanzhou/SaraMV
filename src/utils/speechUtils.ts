// 日语语音播放工具

let japaneseVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

// 初始化并获取日语女声
export function initJapaneseVoice(): Promise<SpeechSynthesisVoice | null> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve(null);
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      
      // 优先选择日语女声
      // 常见的日语女声名称关键词
      const femaleKeywords = ['female', 'woman', 'kyoko', 'haruka', 'sayaka', 'nanami', 'o-ren', '女'];
      
      // 首先尝试找日语女声
      let selectedVoice = voices.find(v => 
        v.lang.startsWith('ja') && 
        femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))
      );
      
      // 如果没有明确标注女声的，选择第一个日语声音（通常默认是女声）
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('ja'));
      }

      japaneseVoice = selectedVoice ?? null;
      voicesLoaded = true;
      resolve(selectedVoice ?? null);
    };

    // 有些浏览器需要等待 voiceschanged 事件
    if (window.speechSynthesis.getVoices().length > 0) {
      loadVoices();
    } else {
      window.speechSynthesis.onvoiceschanged = loadVoices;
      // 备用：500ms 后再尝试
      setTimeout(loadVoices, 500);
    }
  });
}

// 播放日语语音
export function speakJapanese(text: string): void {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    return;
  }

  // 取消之前的语音
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.85; // 稍慢一点便于听清
  utterance.pitch = 1.1; // 略高一点更像女声
  utterance.volume = 1;

  // 如果已经加载了日语语音，使用它
  if (japaneseVoice) {
    utterance.voice = japaneseVoice;
  } else if (!voicesLoaded) {
    // 还没加载过，先初始化
    initJapaneseVoice().then((voice) => {
      if (voice) {
        utterance.voice = voice;
      }
      window.speechSynthesis.speak(utterance);
    });
    return;
  }

  window.speechSynthesis.speak(utterance);
}

// 停止播放
export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// 检查是否支持语音合成
export function isSpeechSupported(): boolean {
  return 'speechSynthesis' in window;
}
