import React, { useState, useRef, useEffect } from "react";

const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
  ? `http://localhost:8080`
  : '';

// Theme definitions
const THEMES = {
  dark: {
    name: "Dark",
    bg: "#0e1012",
    sidebarBg: "#131619",
    border: "#232a2e",
    text: "#e8edef",
    accent: "#29a329",
    accentLight: "#3dd63d",
    accentDark: "#1d6b1d",
    inputBg: "#111518",
    inputBgLight: "#252b30",
    inputBgDark: "#181d21",
    brand: "#29a329",
    buttonText: "#ffffff",
    linkColor: "#42c542",
  },
  light: {
    name: "Light",
    bg: "#3a3f44",
    sidebarBg: "#424850",
    border: "#525a63",
    text: "#f0f0f0",
    accent: "#29a329",
    accentLight: "#3dd63d",
    accentDark: "#1d6b1d",
    inputBg: "#353a3f",
    inputBgLight: "#454d56",
    inputBgDark: "#303540",
    brand: "#29a329",
    buttonText: "#ffffff",
    linkColor: "#42c542",
  },
};

const THEME = THEMES.dark; // Default theme for initial render

// File successfully updated with new layout matching your screenshot


export default function App() {
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [abOptions, setAbOptions] = useState(null); // { a:{text,style}, b:{text,style}, model, responseTime }
  const [abReplaceIndex, setAbReplaceIndex] = useState(null); // when regenerating, replace this index
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [stopClicked, setStopClicked] = useState(false);
  const [micOpen, setMicOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [useAutoModel, setUseAutoModel] = useState(true);
  const [showModelModal, setShowModelModal] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const deepResearch = true; // Web search always enabled
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceType, setVoiceType] = useState("off");
  const [pauseTime, setPauseTime] = useState(1.5);
  const [screenSharing, setScreenSharing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [theme, setTheme] = useState("dark");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [showPrototypeModal, setShowPrototypeModal] = useState(() => {
    try {
      // Only show prototype modal for free users on first visit
      const userType = localStorage.getItem("circuitbot_user_type") || "free";
      if (userType !== "free") return false; // Premium/Developer users skip this
      // Always show for testing/demo purposes
      return true;
    } catch {
      return true;
    }
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profiles, setProfiles] = useState(() => {
    try {
      const raw = localStorage.getItem("circuitbot_profiles");
      if (raw) return JSON.parse(raw);
      return [{ id: "default", name: "Default", guide: "" }];
    } catch {
      return [{ id: "default", name: "Default", guide: "" }];
    }
  });
  const [activeProfileId, setActiveProfileId] = useState(() => {
    try { return localStorage.getItem("circuitbot_active_profile") || "default"; } catch { return "default"; }
  });
  const [userProfile, setUserProfile] = useState(null); // { type: 'free'|'premium'|'developer', name: string }
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [showNewChatPrompt, setShowNewChatPrompt] = useState(false);
  const [newChatInput, setNewChatInput] = useState("");
  const messagesEndRef = useRef(null);
  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];
  const THEME = THEMES[theme] || THEMES.dark; // Dynamic theme based on state
  const recognitionRef = useRef(null);
  const [transcription, setTranscription] = useState("");
  const accumulatedTranscriptRef = useRef("");
  const silenceTimeoutRef = useRef(null);
  const screenStreamRef = useRef(null);
  const canvasRef = useRef(null);
  const screenCaptureIntervalRef = useRef(null);
  const [screenImages, setScreenImages] = useState([]);
  
  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      accumulatedTranscriptRef.current = "";
      setTranscription("");
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // Add final results to accumulated transcript
          accumulatedTranscriptRef.current += transcript + " ";
        } else {
          // Show interim results
          interim += transcript;
        }
      }
      // Update display with accumulated + interim
      setTranscription(accumulatedTranscriptRef.current + interim);
      
      // Reset silence timeout on new input (for Always-On Mic mode)
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
    };

    recognition.onend = () => {
      setTranscription("");
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Handle speech recognition start/stop
  useEffect(() => {
    if (!recognitionRef.current) return;

    if (isListening || micOpen) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Error starting recognition:", e);
      }
    } else {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Error stopping recognition:", e);
      }
    }
  }, [isListening, micOpen]);

  const [userId] = useState(() => {
    try {
      let id = localStorage.getItem("circuitbot_uid");
      if (!id) {
        id = `u_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
        localStorage.setItem("circuitbot_uid", id);
      }
      return id;
    } catch {
      return `u_${Date.now()}`;
    }
  });

  // Handle silence detection and auto-send for Always-On Mic
  useEffect(() => {
    if (!micOpen || isListening) return; // Only for Always-On Mic, not Hold-to-Talk
    
    // Set up silence timeout whenever transcription changes
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    
    // If there's accumulated transcript, set timeout to auto-send
    if (accumulatedTranscriptRef.current.trim()) {
      silenceTimeoutRef.current = setTimeout(async () => {
        const finalTranscription = accumulatedTranscriptRef.current.trim();
        if (!finalTranscription) return;
        
        // Clear for next message
        accumulatedTranscriptRef.current = "";
        setTranscription("");
        
        // Create user message
        const userMessage = { role: "user", content: finalTranscription };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setLoading(true);
        
        // Send to AI
        const modelToUse = useAutoModel ? selectBestModel(finalTranscription) : selectedModel;
        const startTime = Date.now();
        
        try {
          const currentDateTime = new Date().toISOString();
          const response = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: newMessages,
              model: modelToUse,
              profileGuide: activeProfile?.guide || "",
              userId,
              userContext: { name: null, projects: [], interests: [] },
              deepResearch,
              currentDateTime,
            }),
          });
          
          const endTime = Date.now();
          const responseTime = ((endTime - startTime) / 1000).toFixed(2);
          
          if (response.ok) {
            const data = await response.json();
            const text = data.reply || "";
            const sources = extractSources(text);
            const assistantMessage = {
              role: "assistant",
              content: text,
              responseTime: responseTime,
              model: data.model || modelToUse,
              feedback: null,
              sources: sources.length ? sources : null,
            };
            const updatedMessages = [...newMessages, assistantMessage];
            setMessages(updatedMessages);
            setChats(prev => prev.map(chat => chat.id === currentChatId ? { ...chat, messages: updatedMessages } : chat));
          }
        } catch (error) {
          console.error("Error sending Always-On Mic message:", error);
        } finally {
          setLoading(false);
        }
      }, pauseTime * 1000);
    }
    
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, [transcription, micOpen, isListening, pauseTime, messages, selectedModel, useAutoModel, activeProfile, userId, deepResearch, currentChatId]);

  // Load chats from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("circuitbot_chats");
      if (saved) {
        const parsed = JSON.parse(saved);
        setChats(parsed);
        if (parsed.length > 0) {
          setCurrentChatId(parsed[0].id);
          setMessages(parsed[0].messages || []);
        } else {
          createNewChat();
        }
      } else {
        createNewChat();
      }
    } catch (e) {
      console.error("Failed to load chats:", e);
      createNewChat();
    }
    // Ensure theme picker and conversation modal don't show on initial load
    setShowThemePicker(false);
    setShowNewConversationModal(false);
    setLoaded(true);
    setInitialLoad(false);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, abOptions, transcription]);

  // Handle sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(500, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing]);

  // Save chats to localStorage
  useEffect(() => {
    if (loaded && chats.length > 0) {
      try {
        localStorage.setItem("circuitbot_chats", JSON.stringify(chats));
      } catch (e) {
        console.error("Failed to save chats:", e);
      }
    }
  }, [chats, loaded]);

  // Persist profiles
  useEffect(() => {
    try { localStorage.setItem("circuitbot_profiles", JSON.stringify(profiles)); } catch {}
  }, [profiles]);
  useEffect(() => {
    try { localStorage.setItem("circuitbot_active_profile", activeProfileId); } catch {}
  }, [activeProfileId]);

  // Handle theme picker closing and conversation modal opening
  useEffect(() => {
    if (!showThemePicker && showNewConversationModal) {
      // Both states should never be true at the same time
      // This is fine - conversation modal is higher z-index
    }
  }, [showThemePicker, showNewConversationModal]);

  // Force close modals on initial load after slight delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowThemePicker(false);
      setShowNewConversationModal(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Double-check modals are closed when loaded
  useEffect(() => {
    if (loaded) {
      setShowThemePicker(false);
      setShowNewConversationModal(false);
    }
  }, [loaded]);

  const createNewChat = () => {
    setShowNewChatPrompt(true);
    setNewChatInput("");
  };

  const startNewChatWithMessage = async () => {
    if (!newChatInput.trim()) return;

    // Create new chat
    const newChat = {
      id: Date.now().toString(),
      title: "New Chat", // Will be auto-named from first message
      messages: [],
      created: new Date().toISOString(),
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    
    // Set the initial message
    const userMessage = { role: "user", content: newChatInput.trim() };
    setMessages([userMessage]);
    setInput("");
    
    // Close the prompt
    setShowNewChatPrompt(false);
    
    // Send the message immediately
    setLoading(true);
    const modelToUse = useAutoModel ? selectBestModel(newChatInput) : selectedModel;
    const startTime = Date.now();

    try {
      // First turn of a brand-new chat should NOT use A/B
      const endpoint = "/chat";
      const currentDateTime = new Date().toISOString();
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [userMessage],
          model: modelToUse,
          userId,
          profileGuide: activeProfile?.guide || "",
          userContext: { name: null, projects: [], interests: [] },
          currentDateTime,
        }),
      });

      const endTime = Date.now();
      const responseTime = ((endTime - startTime) / 1000).toFixed(2);

      if (response.ok) {
        const data = await response.json();
        if (false) {
          setAbOptions({
            a: { text: data.variants?.[0]?.text || "", style: data.variants?.[0]?.style || "concise" },
            b: { text: data.variants?.[1]?.text || "", style: data.variants?.[1]?.style || "detailed" },
            model: data.model || modelToUse,
            responseTime: data.responseTime || responseTime,
          });
        } else {
          const assistantMessage = { 
            role: "assistant", 
            content: data.reply,
            responseTime: responseTime,
            model: data.model || modelToUse,
            feedback: null
          };
          const updatedMessages = [userMessage, assistantMessage];
          // Auto-generate chat title from first message BEFORE using it
          const firstUserMsg = newChatInput.trim();
          const words = firstUserMsg.split(/\s+/);
          let autoTitle = words.slice(0, 6).join(' ');
          if (words.length > 6) autoTitle += '...';
          setMessages(updatedMessages);
          setChats(prev =>
            prev.map(chat =>
              chat.id === newChat.id
                ? { ...chat, title: autoTitle, messages: updatedMessages }
                : chat
            )
          );
        }

        // already set chat title and messages above in single-reply path
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
    }
  };

  const DEFAULT_MODELS = [
    { id: "auto", name: "Auto (Best for Task)", description: "Automatically selects the best model" },
    { id: "gpt-5.1", name: "GPT-5.1", description: "Latest and most advanced model" },
    { id: "gpt-5", name: "GPT-5", description: "Latest generation model" },
    { id: "gpt-4o", name: "GPT-4o", description: "Capable and optimized" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "Advanced model, faster than GPT-4" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast and efficient for most tasks" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Fast and economical" },
  ];

  // Fetch available models from backend
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${API_BASE}/models`);
        if (response.ok) {
          const data = await response.json();
          // Merge backend models with defaults, keeping auto model first
          const auto = DEFAULT_MODELS[0];
          const backendModels = data.models || [];
          const mergedModels = [auto, ...backendModels.map(m => ({
            id: m.id || m,
            name: m.name || m.id || m,
            description: m.description || "Model available via API"
          }))];
          // Remove duplicates by id
          const uniqueModels = Array.from(new Map(mergedModels.map(m => [m.id, m])).values());
          setAvailableModels(uniqueModels);
        } else {
          setAvailableModels(DEFAULT_MODELS);
        }
      } catch (error) {
        console.log("Using default models", error);
        setAvailableModels(DEFAULT_MODELS);
      }
    };
    fetchModels();
  }, []);

  const selectBestModel = (messageContent) => {
    // Auto-select logic based on message characteristics
    const contentLength = messageContent.length;
    const hasComplexKeywords = /write|essay|article|report|analyze|explain|create|design|code|debug|optimize|review|summarize|research|develop|generate|compose|draft|elaborate|describe|discuss|compare|evaluate/i.test(messageContent);
    const hasWritingTask = /write|essay|article|paper|report|story|blog|post|paragraph|composition|draft/i.test(messageContent);
    const hasWordCount = /\d+\s*(word|words|page|pages)/i.test(messageContent);
    const hasSimpleQuery = /^(hello|hi|thanks|thank you|ok|okay|yes|no|what|who|where|when|why)\b/i.test(messageContent);

    // Check for latest available models first (with fallback to known models)
    const hasGPT51 = availableModels.some(m => m.id === "gpt-5.1");
    const hasGPT5 = availableModels.some(m => m.id === "gpt-5");
    const hasGPT4o = availableModels.some(m => m.id === "gpt-4o");

    if (hasSimpleQuery && contentLength < 50) {
      return "gpt-3.5-turbo"; // Simple queries are fast
    } else if (hasWritingTask || hasWordCount || hasComplexKeywords || contentLength > 150) {
      // Use newest available model for complex tasks, writing, or long requests
      if (hasGPT51) return "gpt-5.1";
      if (hasGPT5) return "gpt-5";
      if (hasGPT4o) return "gpt-4o";
      // Fallback if availableModels not loaded yet
      return "gpt-4o";
    } else if (contentLength > 80) {
      return "gpt-4-turbo"; // Medium tasks
    } else {
      return "gpt-4o-mini"; // Default to mini for general use
    }
  };

  // Handle screen sharing - capture screen every 2 seconds and send live feed to AI
  useEffect(() => {
    if (!screenSharing) {
      // Clean up when stopping screen share
      if (screenCaptureIntervalRef.current) {
        clearInterval(screenCaptureIntervalRef.current);
        screenCaptureIntervalRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setScreenImages([]);
      return;
    }

    // Start screen capture
    const startScreenCapture = async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false,
        });
        screenStreamRef.current = stream;

        // Create canvas and context for capturing frames
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        // Wait for video to load before getting dimensions
        video.onloadedmetadata = () => {
          // Scale down to max 800px width to reduce image size significantly
          const maxWidth = 800;
          const scale = Math.min(1, maxWidth / video.videoWidth);
          canvas.width = video.videoWidth * scale;
          canvas.height = video.videoHeight * scale;

          // Capture and send frames every 2 seconds
          screenCaptureIntervalRef.current = setInterval(async () => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = canvas.toDataURL('image/jpeg', 0.3); // Compress to 30% quality
              
              // Store the current frame
              setScreenImages([imageData]);
              
              // Don't send live updates - only send image when user sends message
            }
          }, 2000); // 2 second interval
        };

        // Handle stream ending (user stops sharing)
        stream.getVideoTracks()[0].onended = () => {
          setScreenSharing(false);
        };
      } catch (error) {
        console.error("Error starting screen capture:", error);
        setScreenSharing(false);
      }
    };

    startScreenCapture();

    return () => {
      if (screenCaptureIntervalRef.current) {
        clearInterval(screenCaptureIntervalRef.current);
        screenCaptureIntervalRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
    };
  }, [screenSharing]);

  // File handling
  const handleFileSelect = (files) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachedFiles(prev => [...prev, {
          name: file.name,
          content: e.target.result,
          type: file.type,
        }]);
      };
      reader.readAsText(file);
    });
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const removeAttachedFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;

    // If no chat exists, create one first
    if (currentChatId === null) {
      createNewChat();
      // Return early - the new chat will trigger a re-render and the message will be sent in the next call
      return;
    }

    const userMessage = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const modelToUse = useAutoModel ? selectBestModel(input) : selectedModel;
    const startTime = Date.now();

    try {
      // Use A/B infrequently: only on every 25th assistant reply
      const assistantCount = messages.filter(m => m.role === 'assistant').length;
      const nextAssistantNumber = assistantCount + 1;
      const useAb = (nextAssistantNumber % 25 === 0);
      const endpoint = useAb ? "/chat-ab" : "/chat";
      const currentDateTime = new Date().toISOString();
      
      // Prepare message with screen images if available
      const messagePayload = {
        messages: newMessages,
        model: modelToUse,
        profileGuide: activeProfile?.guide || "",
        userId,
        userContext: { name: null, projects: [], interests: [] },
        deepResearch,
        currentDateTime,
        voiceEnabled: voiceType === "alloy",
        selectedVoice: voiceType === "alloy" ? voiceType : null,
        voiceSpeed,
      };
      
      // Add screen images if screen sharing is active
      if (screenImages.length > 0) {
        messagePayload.screenImages = screenImages;
        messagePayload.screenSharingActive = true;
      }
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messagePayload),
      });

      const endTime = Date.now();
      const responseTime = ((endTime - startTime) / 1000).toFixed(2);

      if (response.ok) {
        const data = await response.json();
        if (useAb) {
          setAbOptions({
            a: { text: data.variants?.[0]?.text || "", style: data.variants?.[0]?.style || "concise" },
            b: { text: data.variants?.[1]?.text || "", style: data.variants?.[1]?.style || "detailed" },
            model: data.model || modelToUse,
            responseTime: data.responseTime || responseTime,
          });
        } else {
          // Single reply path (no A/B)
          const text = data.reply || "";
          const audioUrl = data.audioUrl || null;
          const sources = extractSources(text);
          const assistantMessage = { 
            role: "assistant", 
            content: text,
            responseTime: responseTime,
            model: data.model || modelToUse,
            feedback: null,
            sources: sources.length ? sources : null,
          };
          const updatedMessages = [...newMessages, assistantMessage];
          setMessages(updatedMessages);
          
          // Play audio response if AI voice is enabled and audioUrl is provided
          if (voiceType === "alloy" && audioUrl) {
            try {
              const audio = new Audio(audioUrl);
              audio.play().catch(e => console.error("Audio playback error:", e));
            } catch (e) {
              console.error("Audio playback setup error:", e);
            }
          }
          
          if (messages.length === 1 && messages[0].role === "user") {
            const firstUserMsg = messages[0].content;
            const words = firstUserMsg.split(/\s+/);
            let autoTitle = words.slice(0, 6).join(' ');
            if (words.length > 6) autoTitle += '...';
            setChats(prev => prev.map(chat => chat.id === currentChatId ? { ...chat, title: autoTitle, messages: updatedMessages } : chat));
          } else {
            setChats(prev => prev.map(chat => chat.id === currentChatId ? { ...chat, messages: updatedMessages } : chat));
          }
        }

      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("API Error:", response.status, errorData);
        const errorMessage = { 
          role: "assistant", 
          content: `Error: ${errorData.error || response.statusText}. Model: ${modelToUse}`,
          responseTime: responseTime
        };
        const updatedMessages = [...newMessages, errorMessage];
        setMessages(updatedMessages);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper: extract sources/links from text
  const extractSources = (text) => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const urlRegex = /https?:\/\/[^\s<]+/g;
    const sources = [];
    let match;
    while ((match = linkRegex.exec(text)) !== null) {
      sources.push({ title: match[1], url: match[2] });
    }
    if (sources.length === 0) {
      const urls = text.match(urlRegex) || [];
      urls.forEach((url) => sources.push({ title: url, url }));
    }
    return sources;
  };

  const commitChosenVariant = async (choice) => {
    if (!abOptions) return;
    const variant = choice === 'A' ? abOptions.a : abOptions.b;
    const text = variant.text || "";
    const audioUrl = variant.audioUrl || null;

    // Extract sources/links from the chosen response
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const urlRegex = /https?:\/\/[^\s<]+/g;
    const sources = [];
    let match;
    while ((match = linkRegex.exec(text)) !== null) {
      sources.push({ title: match[1], url: match[2] });
    }
    if (sources.length === 0) {
      const urls = text.match(urlRegex) || [];
      urls.forEach((url) => sources.push({ title: url, url }));
    }

    const assistantMessage = {
      role: "assistant",
      content: text,
      responseTime: abOptions.responseTime,
      model: abOptions.model,
      feedback: null,
      sources: sources.length > 0 ? sources : null,
    };
    let updatedMessages;
    if (abReplaceIndex !== null && abReplaceIndex >= 0 && abReplaceIndex < messages.length) {
      updatedMessages = [...messages];
      updatedMessages.splice(abReplaceIndex, 1, assistantMessage);
    } else {
      updatedMessages = [...messages, assistantMessage];
    }
    setMessages(updatedMessages);
    setChats((prev) => prev.map((chat) => (
      chat.id === currentChatId ? { ...chat, messages: updatedMessages } : chat
    )));
    
    // Play audio response if AI voice is enabled and audioUrl is provided
    if (voiceType === "alloy" && audioUrl) {
      try {
        const audio = new Audio(audioUrl);
        audio.play().catch(e => console.error("Audio playback error:", e));
      } catch (e) {
        console.error("Audio playback setup error:", e);
      }
    }
    
    const styles = { A: abOptions.a.style, B: abOptions.b.style };
    setAbOptions(null);
    setAbReplaceIndex(null);
    try {
      await fetch(`${API_BASE}/ab/choice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, choice, styles }),
      });
    } catch (e) {
      console.warn('Failed to store A/B choice', e);
    }
  };

  // Regenerate the last assistant message (or at provided index if needed)
  const regenerateMessage = async (index) => {
    const idx = typeof index === 'number' ? index : messages.length - 1;
    const msg = messages[idx];
    if (!msg || msg.role !== 'assistant') return;

    const baseMessages = messages.slice(0, idx); // exclude the old assistant
    const lastUser = [...baseMessages].reverse().find(m => m.role === 'user');
    const modelToUse = typeof msg.model === 'string' && msg.model ? msg.model : (useAutoModel && lastUser ? selectBestModel(lastUser.content || '') : selectedModel);

    setLoading(true);
    try {
      // Regenerate follows the same cadence: only on every 25th assistant position
      const baseAssistantCount = baseMessages.filter(m => m.role === 'assistant').length;
      const nextAssistantNumber = baseAssistantCount + 1;
      const useAb = (nextAssistantNumber % 25 === 0);
      const endpoint = useAb ? '/chat-ab' : '/chat';
      const currentDateTime = new Date().toISOString();
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: baseMessages,
          model: modelToUse,
          userId,
          profileGuide: activeProfile?.guide || '',
          deepResearch,
          currentDateTime,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (useAb) {
          setAbReplaceIndex(idx);
          setAbOptions({
            a: { text: data.variants?.[0]?.text || '', style: data.variants?.[0]?.style || 'concise' },
            b: { text: data.variants?.[1]?.text || '', style: data.variants?.[1]?.style || 'detailed' },
            model: data.model || modelToUse,
            responseTime: data.responseTime || null,
          });
        } else {
          const text = data.reply || '';
          const sources = extractSources(text);
          const assistantMessage = {
            role: 'assistant',
            content: text,
            responseTime: null,
            model: data.model || modelToUse,
            feedback: null,
            sources: sources.length ? sources : null,
          };
          const updated = [...messages];
          updated.splice(idx, 1, assistantMessage);
          setMessages(updated);
          setChats(prev => prev.map(chat => chat.id === currentChatId ? { ...chat, messages: updated } : chat));
        }
      }
    } catch (e) {
      console.error('Regenerate error:', e);
    } finally {
      setLoading(false);
    }
  };

  const selectChat = (chatId) => {
    setCurrentChatId(chatId);
    const chat = chats.find(c => c.id === chatId);
    setMessages(chat?.messages || []);
  };

  const handleFeedback = (messageIndex, feedback) => {
    const updatedMessages = messages.map((msg, idx) => {
      if (idx === messageIndex) {
        // If clicking the same feedback, remove it (toggle off)
        if (msg.feedback === feedback) {
          return { ...msg, feedback: null };
        }
        // Otherwise set the new feedback
        return { ...msg, feedback };
      }
      return msg;
    });
    setMessages(updatedMessages);
    
    // Update chat in state
    setChats(prev =>
      prev.map(chat =>
        chat.id === currentChatId
          ? { ...chat, messages: updatedMessages }
          : chat
      )
    );
  };

  const startEditingChat = (chatId, currentTitle) => {
    setEditingChatId(chatId);
    setEditingTitle(currentTitle);
  };

  const saveChatTitle = (chatId) => {
    if (editingTitle.trim()) {
      setChats(prev =>
        prev.map(chat =>
          chat.id === chatId ? { ...chat, title: editingTitle.trim() } : chat
        )
      );
    }
    setEditingChatId(null);
    setEditingTitle("");
  };

  const deleteChat = (chatId) => {
    const remaining = chats.filter(c => c.id !== chatId);
    setChats(remaining);
    
    if (currentChatId === chatId) {
      if (remaining.length > 0) {
        selectChat(remaining[0].id);
      } else {
        // No chats left - clear everything
        setCurrentChatId(null);
        setMessages([]);
      }
    }
  };

  const clearAllChats = () => {
    if (window.confirm('Delete all chats? This cannot be undone.')) {
      setChats([]);
      createNewChat();
    }
  };

  const formatMessage = (content) => {
    if (typeof content !== 'string') return content;
    
    // Convert markdown-style formatting to HTML-like styling
    const lines = content.split('\n');
    const formatted = [];
    
    lines.forEach((line, idx) => {
      // Headings
      if (line.startsWith('# ')) {
        formatted.push(
          <div key={idx} style={{ fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 8, lineHeight: 1.3 }}>
            {line.substring(2)}
          </div>
        );
      } else if (line.startsWith('## ')) {
        formatted.push(
          <div key={idx} style={{ fontSize: 17, fontWeight: 'bold', marginTop: 14, marginBottom: 6, lineHeight: 1.3 }}>
            {line.substring(3)}
          </div>
        );
      } else if (line.startsWith('### ')) {
        formatted.push(
          <div key={idx} style={{ fontSize: 15, fontWeight: '600', marginTop: 12, marginBottom: 4, lineHeight: 1.3 }}>
            {line.substring(4)}
          </div>
        );
      }
      // Bullet points
      else if (line.match(/^[\*\-•]\s/)) {
        formatted.push(
          <div key={idx} style={{ marginLeft: 16, marginTop: 4, marginBottom: 4 }}>
            • {line.substring(2)}
          </div>
        );
      }
      // Numbered lists
      else if (line.match(/^\d+\.\s/)) {
        formatted.push(
          <div key={idx} style={{ marginLeft: 16, marginTop: 4, marginBottom: 4 }}>
            {line}
          </div>
        );
      }
      // Empty lines for spacing
      else if (line.trim() === '') {
        formatted.push(<div key={idx} style={{ height: 8 }} />);
      }
      // Bold text
      else {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        formatted.push(
          <div key={idx} style={{ marginTop: 6, marginBottom: 6, lineHeight: 1.6 }}>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </div>
        );
      }
    });
    
    return <>{formatted}</>;
  };

  if (!loaded) {
    return (
      <div style={{
        display: "flex",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: THEME.bg,
        color: THEME.text,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        fontSize: 14,
        letterSpacing: "-0.01em",
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      width: "100vw",
      background: THEME.bg,
      color: THEME.text,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      fontSize: 14,
      letterSpacing: "-0.01em",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      {/* Sidebar */}
      <div style={{
        width: sidebarWidth,
        background: THEME.sidebarBg,
        borderRight: `1px solid ${THEME.border}`,
        display: "flex",
        flexDirection: "column",
        padding: 12,
        gap: 12,
        overflow: "hidden",
        position: "relative",
      }}>
        <img
          src={theme === "dark" || theme === "light" ? "/circuitbot-logo-white.png" : "/circuitbot-logo-black.png"}
          alt="CircuitBot.AI"
          style={{
            width: "100%",
            height: "auto",
            maxHeight: 80,
            objectFit: "contain",
            marginBottom: 8,
          }}
        />
        <div style={{ width: "100%" }}>
          <button
            onClick={createNewChat}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: showNewChatPrompt
                ? `linear-gradient(180deg, ${THEME.accentLight} 0%, ${THEME.accentDark} 100%)`
                : "#303540",
              color: THEME.buttonText,
              border: `1px solid ${THEME.accentLight}`,
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 400,
              fontSize: 14,
              transition: "all 0.2s",
              boxSizing: "border-box",
            }}
            onMouseEnter={e => {
              e.target.style.color = THEME.accentLight;
              e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
              e.target.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.target.style.color = THEME.buttonText;
              e.target.style.boxShadow = "none";
              e.target.style.transform = "translateY(0)";
            }}>
            + New Chat
          </button>
        </div>
        
        {/* Chat History */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
          {chats.map((chat, idx) => (
            <div key={chat.id} style={{
              marginBottom: 0,
              borderBottom: idx !== chats.length - 1 ? `1px solid ${THEME.border}` : "none",
              paddingBottom: 10,
              marginTop: 2,
              transition: "border 0.2s",
              width: "100%",
              boxSizing: "border-box",
            }}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 4,
                  background: currentChatId === chat.id ? THEME.inputBgDark : "transparent",
                  borderRadius: 6,
                  padding: 0,
                  position: "relative",
                  minWidth: 0,
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  ...(currentChatId === chat.id ? { } : {}),
                }}>
                {currentChatId === chat.id && (
                  <div style={{
                    position: "absolute",
                    left: -3,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    borderRadius: "6px 0 0 6px",
                    background: THEME.accent,
                  }} />
                )}
              {editingChatId === chat.id ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => saveChatTitle(chat.id)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      saveChatTitle(chat.id);
                    } else if (e.key === "Escape") {
                      setEditingChatId(null);
                      setEditingTitle("");
                    }
                  }}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    background: THEME.inputBg,
                    border: `1px solid ${THEME.accent}`,
                    borderRadius: 6,
                    color: THEME.text,
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              ) : (
                <div
                  onClick={() => selectChat(chat.id)}
                  onDoubleClick={() => startEditingChat(chat.id, chat.title)}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    marginLeft: 0,
                    background: "transparent",
                    cursor: "pointer",
                    borderRadius: 6,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: 13,
                    color: currentChatId === chat.id ? "#fff" : THEME.text,
                    position: "relative",
                    zIndex: 1,
                  }}
                  title="Double-click to rename"
                >
                  {chat.title}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(chat.id);
                }}
                style={{
                  padding: "6px 8px",
                  marginRight: 6,
                  background: "transparent",
                  border: "none",
                  color: currentChatId === chat.id ? "#fff" : THEME.text,
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                  transition: "all 0.2s",
                  flexShrink: 0,
                  opacity: currentChatId === chat.id ? 1 : 0.5,
                  boxShadow: "none",
                  outline: "none",
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseEnter={e => {
                  e.target.style.color = "#ff4444";
                  e.target.style.opacity = 1;
                }}
                onMouseLeave={e => {
                  e.target.style.color = currentChatId === chat.id ? "#fff" : THEME.text;
                  e.target.style.opacity = currentChatId === chat.id ? 1 : 0.5;
                }}
                title="Delete chat"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              </div>
            </div>
          ))}
        </div>

        {/* Companion Image - Above Control Buttons */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 8,
        }}>
          <img
            src="/my-companion.png"
            alt="Companion"
            style={{
              width: "80%",
              height: "auto",
              maxHeight: 200,
              objectFit: "contain",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Menu Buttons Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* AI Voice Toggle */}
          <button
            onClick={() => setVoiceType(voiceType === "alloy" ? "disabled" : "alloy")}
            style={{
              padding: "12px 14px",
              background: voiceType === "alloy" ? "linear-gradient(180deg, #ff6666 0%, #cc0000 100%)" : `linear-gradient(180deg, ${THEME.accentLight} 0%, ${THEME.accentDark} 100%)`,
              border: `1px solid ${voiceType === "alloy" ? "#ff4444" : THEME.accentLight}`,
              color: "white",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              transition: "all 0.2s",
              textAlign: "center",
            }}
            onMouseEnter={e => {
              if (voiceType !== "alloy") {
                e.target.style.opacity = "0.8";
                e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                e.target.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={e => {
              e.target.style.opacity = "1";
              e.target.style.boxShadow = "none";
              e.target.style.transform = "translateY(0)";
            }}
            title="Enable/disable AI voice responses"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}>
              <path d="M1 9v6" />
              <path d="M5 4v16" />
              <path d="M9 2v20" />
              <path d="M13 2v20" />
              <path d="M17 4v16" />
              <path d="M21 6v12" />
            </svg>
            {voiceType === "alloy" ? "AI Voice On" : "AI Voice Off"}
          </button>

          <button
            onClick={() => setShowThemePicker(!showThemePicker)}
            style={{
              padding: "12px 14px",
              background: "#303540",
              border: `1px solid ${THEME.accent}`,
              color: THEME.text,
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              e.target.style.color = THEME.accentLight;
              e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
              e.target.style.transform = "translateY(-2px)";
              const circles = e.target.querySelectorAll('circle');
              circles.forEach(circle => {
                circle.style.fill = THEME.accentLight;
              });
              const paths = e.target.querySelectorAll('path');
              paths.forEach(path => {
                path.style.stroke = THEME.accentLight;
              });
            }}
            onMouseLeave={e => {
              e.target.style.color = THEME.text;
              e.target.style.boxShadow = "none";
              e.target.style.transform = "translateY(0)";
              const circles = e.target.querySelectorAll('circle');
              circles.forEach(circle => {
                circle.style.fill = "#3dd63d";
              });
              const paths = e.target.querySelectorAll('path');
              paths.forEach(path => {
                path.style.stroke = "white";
              });
            }}
            title="Choose theme"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}>
              <circle cx="13.5" cy="6.5" r=".5" fill="#3dd63d"/>
              <circle cx="17.5" cy="10.5" r=".5" fill="#3dd63d"/>
              <circle cx="8.5" cy="7.5" r=".5" fill="#3dd63d"/>
              <circle cx="6.5" cy="12.5" r=".5" fill="#3dd63d"/>
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" fill="none" stroke="white" className="theme-path"/>
            </svg>
            Themes
          </button>

          {/* AI Settings - Combined Voice & Model */}
          <button
            onClick={() => setShowModelModal(true)}
            style={{
              padding: "12px 14px",
              background: "#303540",
              border: `1px solid ${THEME.accent}`,
              color: THEME.text,
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              transition: "all 0.2s",
              textAlign: "center",
            }}
            onMouseEnter={e => {
              e.target.style.color = THEME.accentLight;
              e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
              e.target.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.target.style.color = THEME.text;
              e.target.style.boxShadow = "none";
              e.target.style.transform = "translateY(0)";
            }}
            title="AI Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}>
              <rect width="16" height="16" x="4" y="4" rx="2"/>
              <rect width="6" height="6" x="9" y="9" rx="1"/>
              <path d="M15 2v2"/>
              <path d="M15 20v2"/>
              <path d="M2 15h2"/>
              <path d="M2 9h2"/>
              <path d="M20 15h2"/>
              <path d="M20 9h2"/>
              <path d="M9 2v2"/>
              <path d="M9 20v2"/>
            </svg>
            AI Settings
          </button>

          <button style={{
            padding: "12px 14px",
            background: "#303540",
            border: `1px solid ${THEME.accent}`,
            color: THEME.text,
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            e.target.style.color = THEME.accentLight;
            e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
            e.target.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={e => {
            e.target.style.color = THEME.text;
            e.target.style.boxShadow = "none";
            e.target.style.transform = "translateY(0)";
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}>
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
            Images
          </button>

          {/* Profile / Login Button */}
          {userProfile ? (
            <button
              onClick={() => setShowProfileModal(true)}
              style={{
                width: "100%",
                padding: "12px",
                background: "#303540",
                border: `1px solid ${THEME.accent}`,
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                transition: "all 0.2s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = THEME.border;
                e.currentTarget.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "#303540";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
              title="Change Profile"
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: userProfile.type === 'developer' ? '#ffd700' : userProfile.type === 'premium' ? '#29a329' : '#888',
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: "bold",
                color: userProfile.type === 'developer' ? '#000' : 'white',
                flexShrink: 0,
              }}>
                {userProfile.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: "bold", color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {userProfile.name}
                </div>
                <div style={{ fontSize: 11, color: THEME.accentLight, textTransform: "capitalize" }}>
                  {userProfile.type}
                </div>
              </div>
            </button>
          ) : (
            <button
              onClick={() => setShowProfileModal(true)}
              style={{
                width: "100%",
                padding: "12px",
                background: "#303540",
                border: `1px solid ${THEME.accent}`,
                color: THEME.text,
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                transition: "all 0.2s",
                minHeight: "60px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={e => {
                e.target.style.color = THEME.accentLight;
                e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                e.target.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                e.target.style.color = THEME.text;
                e.target.style.boxShadow = "none";
                e.target.style.transform = "translateY(0)";
              }}
              title="Log In"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}>
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              </svg>
              Log In
            </button>
          )}
        </div>

        {/* New Chat Prompt Modal */}
        {showNewChatPrompt && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            }}
            onClick={() => setShowNewChatPrompt(false)}
          >
            <div
              style={{
                background: THEME.inputBg,
                border: `2px solid ${THEME.border}`,
                borderRadius: 12,
                padding: 24,
                maxWidth: 500,
                width: "90%",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: "0 0 8px 0", fontSize: 20, color: THEME.text }}>
                  Start a New Conversation
                </h2>
                <p style={{ margin: "0", fontSize: 12, opacity: 0.6, color: THEME.text }}>
                  What would you like to talk about?
                </p>
              </div>

              <textarea
                value={newChatInput}
                onChange={(e) => setNewChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    startNewChatWithMessage();
                  }
                }}
                placeholder="Type your message here..."
                autoFocus
                style={{
                  width: "100%",
                  minHeight: 100,
                  padding: "12px 16px",
                  background: THEME.bg,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 8,
                  color: THEME.text,
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical",
                  outline: "none",
                  marginBottom: 16,
                }}
              />

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowNewChatPrompt(false)}
                  style={{
                    padding: "10px 20px",
                    background: "transparent",
                    border: `1px solid ${THEME.border}`,
                    color: THEME.text,
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = THEME.inputBg;
                    e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                    e.target.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = "transparent";
                    e.target.style.boxShadow = "none";
                    e.target.style.transform = "translateY(0)";
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={startNewChatWithMessage}
                  style={{
                    padding: "10px 20px",
                    background: `linear-gradient(180deg, ${THEME.accentLight} 0%, ${THEME.accentDark} 100%)`,
                    border: "none",
                    color: "#ffffff",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: "bold",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                    e.target.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.target.style.boxShadow = "none";
                    e.target.style.transform = "translateY(0)";
                  }}
                >
                  Start Chat
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Settings Modal */}
        {showModelModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            }}
            onClick={() => setShowModelModal(false)}
          >
            <div
              style={{
                background: THEME.inputBg,
                border: `2px solid ${THEME.border}`,
                borderRadius: 12,
                padding: 24,
                maxWidth: 600,
                width: "90%",
                maxHeight: "80vh",
                overflowY: "auto",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: "0 0 8px 0", fontSize: 20, color: THEME.text }}>
                  AI Settings
                </h2>
                <p style={{ margin: "0", fontSize: 12, opacity: 0.6, color: THEME.text }}>
                  Configure your AI model and voice settings
                </p>
              </div>

              {/* Model Selection */}
              <div style={{
                marginBottom: 16,
                padding: 16,
                background: `linear-gradient(180deg, ${THEME.inputBgLight} 0%, ${THEME.inputBgDark} 100%)`,
                border: `1px solid ${THEME.border}`,
                borderRadius: 12,
              }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 16, color: THEME.text, fontWeight: 600 }}>
                  AI Model
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {availableModels.map(model => (
                    <div
                      key={model.id}
                      onClick={() => {
                        if (model.id === "auto") {
                          setUseAutoModel(true);
                        } else {
                          setUseAutoModel(false);
                          setSelectedModel(model.id);
                        }
                      }}
                      style={{
                        padding: 16,
                        background:
                          (model.id === "auto" && useAutoModel) ||
                          (model.id === selectedModel && !useAutoModel)
                            ? THEME.accent
                            : THEME.bg,
                        color:
                          (model.id === "auto" && useAutoModel) ||
                          (model.id === selectedModel && !useAutoModel)
                            ? THEME.buttonText
                            : THEME.text,
                        border: `1px solid ${THEME.border}`,
                        borderRadius: 8,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={e => {
                        if (
                          !((model.id === "auto" && useAutoModel) ||
                            (model.id === selectedModel && !useAutoModel))
                        ) {
                          e.currentTarget.style.background = THEME.inputBg;
                        }
                      }}
                      onMouseLeave={e => {
                        if (
                          !((model.id === "auto" && useAutoModel) ||
                            (model.id === selectedModel && !useAutoModel))
                        ) {
                          e.currentTarget.style.background = THEME.bg;
                        }
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                            {model.name}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            {model.description}
                          </div>
                        </div>
                        <div style={{ fontSize: 18 }}>
                          {(model.id === "auto" && useAutoModel) ||
                          (model.id === selectedModel && !useAutoModel)
                            ? "✓"
                            : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deep Research */}
              <div style={{
                marginBottom: 16,
                padding: 16,
                background: `linear-gradient(180deg, ${THEME.inputBgLight} 0%, ${THEME.inputBgDark} 100%)`,
                border: `1px solid ${THEME.border}`,
                borderRadius: 12,
              }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 16, color: THEME.text, fontWeight: 600 }}>
                  AI Voice
                </h3>
                
                {/* Voice Type */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, color: THEME.text, marginBottom: 8, display: "block" }}>Voice Type</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      value={voiceType}
                      onChange={e => setVoiceType(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        background: THEME.inputBg,
                        border: `1px solid ${THEME.border}`,
                        color: THEME.text,
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 500,
                        outline: "none",
                        textTransform: "capitalize",
                      }}
                    >
                      <option value="alloy">Alloy - Neutral and balanced</option>
                      <option value="echo">Echo - Clear and articulate</option>
                      <option value="fable">Fable - Warm and expressive</option>
                      <option value="onyx">Onyx - Deep and authoritative</option>
                      <option value="nova">Nova - Energetic and friendly</option>
                      <option value="shimmer">Shimmer - Soft and gentle</option>
                    </select>
                    <button
                      onClick={async () => {
                        try {
                          const sampleText = "Hello! This is a sample of my voice.";
                          const response = await fetch(`${API_BASE}/api/tts-preview`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              text: sampleText,
                              voice: voiceType,
                              speed: voiceSpeed
                            })
                          });
                          
                          if (response.ok) {
                            const audioBlob = await response.blob();
                            const audioUrl = URL.createObjectURL(audioBlob);
                            const audio = new Audio(audioUrl);
                            audio.play();
                            audio.onended = () => URL.revokeObjectURL(audioUrl);
                          }
                        } catch (error) {
                          console.error('Voice preview error:', error);
                        }
                      }}
                      style={{
                        padding: "10px 14px",
                        background: `linear-gradient(180deg, ${THEME.accentLight} 0%, ${THEME.accentDark} 100%)`,
                        border: "none",
                        color: THEME.buttonText,
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                        transition: "all 0.2s",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexShrink: 0,
                      }}
                      title="Test voice"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline-block' }}>
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      Test
                    </button>
                  </div>
                </div>

                {/* Sliders side by side */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Voice Speed */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <label style={{ fontSize: 13, color: THEME.text }}>Speech Speed</label>
                      <span style={{ fontSize: 13, color: THEME.accentLight, fontWeight: 600 }}>{voiceSpeed.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={voiceSpeed}
                      onChange={e => setVoiceSpeed(parseFloat(e.target.value))}
                      style={{
                        width: "100%",
                        height: 6,
                        borderRadius: 3,
                        outline: "none",
                        background: `linear-gradient(to right, ${THEME.accent} 0%, ${THEME.accent} ${((voiceSpeed - 0.5) / 1.5) * 100}%, ${THEME.border} ${((voiceSpeed - 0.5) / 1.5) * 100}%, ${THEME.border} 100%)`,
                        appearance: "none",
                        WebkitAppearance: "none",
                        cursor: "pointer",
                      }}
                    />
                  </div>

                  {/* Pause Time */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <label style={{ fontSize: 13, color: THEME.text }}>Pause Before Reply</label>
                      <span style={{ fontSize: 13, color: THEME.accentLight, fontWeight: 600 }}>{pauseTime.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="5.0"
                      step="0.5"
                      value={pauseTime}
                      onChange={e => setPauseTime(parseFloat(e.target.value))}
                      style={{
                        width: "100%",
                        height: 6,
                        borderRadius: 3,
                        outline: "none",
                        background: `linear-gradient(to right, ${THEME.accent} 0%, ${THEME.accent} ${((pauseTime - 0.5) / 4.5) * 100}%, ${THEME.border} ${((pauseTime - 0.5) / 4.5) * 100}%, ${THEME.border} 100%)`,
                        appearance: "none",
                        WebkitAppearance: "none",
                        cursor: "pointer",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Response Preferences (moved to end) */}
              <div style={{
                marginTop: 16,
                padding: 16,
                background: `linear-gradient(180deg, ${THEME.inputBgLight} 0%, ${THEME.inputBgDark} 100%)`,
                border: `1px solid ${THEME.border}`,
                borderRadius: 12,
              }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 16, color: THEME.text, fontWeight: 600 }}>
                  Response Preferences
                </h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  {profiles.map(p => (
                    <div key={p.id}
                      onClick={() => setActiveProfileId(p.id)}
                      style={{
                        padding: 10,
                        borderRadius: 6,
                        cursor: 'pointer',
                        border: `1px solid ${p.id === activeProfileId ? THEME.accent : THEME.border}`,
                        background: p.id === activeProfileId ? THEME.accent : THEME.bg,
                        color: p.id === activeProfileId ? THEME.buttonText : THEME.text,
                        minWidth: 80,
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >{p.name}</div>
                  ))}
                  <button
                    onClick={() => {
                      const id = `p_${Math.random().toString(36).slice(2, 8)}`;
                      setProfiles(prev => [...prev, { id, name: `Profile ${prev.length + 1}`, guide: "" }]);
                      setActiveProfileId(id);
                    }}
                    style={{ padding: '8px 10px', border: `1px solid ${THEME.accent}`, color: THEME.text, background: 'transparent', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                  >+ Add</button>
                  {activeProfileId !== 'default' && (
                    <button
                      onClick={() => {
                        setProfiles(prev => prev.filter(p => p.id !== activeProfileId));
                        setActiveProfileId('default');
                      }}
                      style={{ padding: '8px 10px', border: `1px solid ${THEME.border}`, color: '#ff6666', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                    >Delete</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, color: THEME.text, minWidth: 70 }}>Name</label>
                  <input value={activeProfile?.name || ''}
                    onChange={e => setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, name: e.target.value } : p))}
                    style={{ flex: 1, padding: '10px 12px', background: THEME.inputBg, border: `1px solid ${THEME.border}`, color: THEME.text, borderRadius: 6, outline: 'none', fontSize: 13 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ fontSize: 13, color: THEME.text, minWidth: 70, marginTop: 6 }}>Style Guide</label>
                  <textarea value={activeProfile?.guide || ''}
                    onChange={e => setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, guide: e.target.value } : p))}
                    rows={4}
                    placeholder="Describe how the bot should talk (tone, structure, do/don'ts)."
                    style={{ flex: 1, padding: '10px 12px', background: THEME.inputBg, border: `1px solid ${THEME.border}`, color: THEME.text, borderRadius: 6, outline: 'none', fontSize: 13, resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Prototype Info Modal */}
        {showPrototypeModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3000,
            }}
            onClick={() => setShowPrototypeModal(false)}
          >
            <div
              style={{
                background: THEME.inputBg,
                border: `2px solid ${THEME.accentLight}`,
                borderRadius: 16,
                padding: 40,
                maxWidth: 600,
                width: "90%",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
                textAlign: "center",
              }}
              onClick={e => e.stopPropagation()}
            >
              <h1 style={{ 
                margin: "0 0 16px 0", 
                fontSize: 32, 
                fontWeight: 700, 
                color: THEME.accentLight,
              }}>
                CircuitBot.AI Prototype
              </h1>
              <p style={{
                margin: "0 0 24px 0",
                fontSize: 16,
                lineHeight: 1.6,
                color: THEME.text,
              }}>
                This is the first deployment of CircuitBot.AI, created to prove the concept of <strong>real-time screen sharing with simultaneous voice input and AI-generated voice responses</strong>. While not optimized, polished, or bug-free, it successfully demonstrates this unified interaction model.
              </p>
              <div style={{
                background: THEME.inputBgDark,
                border: `1px solid ${THEME.border}`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
              }}>
                <p style={{
                  margin: "0 0 12px 0",
                  fontSize: 13,
                  color: THEME.text,
                  opacity: 0.7,
                }}>
                  Feature comparison as of <strong>November 20, 2025</strong>
                </p>
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${THEME.border}` }}>
                      <th style={{ textAlign: "left", padding: "8px 0", color: THEME.text, fontWeight: 600 }}>Feature</th>
                      <th style={{ textAlign: "center", padding: "8px 0", color: THEME.accentLight, fontWeight: 600 }}>CircuitBot</th>
                      <th style={{ textAlign: "center", padding: "8px 0", color: THEME.text, fontWeight: 600 }}>Copilot</th>
                      <th style={{ textAlign: "center", padding: "8px 0", color: THEME.text, fontWeight: 600 }}>ChatGPT</th>
                      <th style={{ textAlign: "center", padding: "8px 0", color: THEME.text, fontWeight: 600 }}>Meta AI</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: `1px solid ${THEME.border}` }}>
                      <td style={{ padding: "10px 0", color: THEME.text }}>Real-time Screen Sharing</td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#29a329" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${THEME.border}` }}>
                      <td style={{ padding: "10px 0", color: THEME.text }}>Voice Input & Speech Transcription</td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#29a329" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#29a329" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#29a329" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#29a329" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${THEME.border}` }}>
                      <td style={{ padding: "10px 0", color: THEME.text }}>AI Voice Response</td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#29a329" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#29a329" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#29a329" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#29a329" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${THEME.border}` }}>
                      <td style={{ padding: "10px 0", color: THEME.text }}>Real-time Screen Analysis</td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#29a329" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></td>
                    </tr>
                    <tr style={{ borderTop: `2px solid ${THEME.border}` }}>
                      <td style={{ padding: "10px 0", color: THEME.text, fontWeight: 600 }}>All Features Combined</td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#29a329" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p style={{
                margin: "0 0 20px 0",
                fontSize: 14,
                color: THEME.text,
                opacity: 0.8,
              }}>
                Questions or feedback? Contact the developer:
              </p>
              <div style={{
                fontSize: 18,
                fontWeight: 600,
                color: THEME.accentLight,
                marginBottom: 24,
                fontFamily: "monospace",
              }}>
                martystorm1@gmail.com
              </div>
              <button
                onClick={() => {
                  localStorage.setItem("circuitbot_seen_prototype", "true");
                  setShowPrototypeModal(false);
                  setShowThemePicker(true);
                }}
                style={{
                  padding: "12px 32px",
                  background: `linear-gradient(180deg, ${THEME.accentLight} 0%, ${THEME.accentDark} 100%)`,
                  border: `1px solid ${THEME.accentLight}`,
                  color: "white",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 16,
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => {
                  e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                  e.target.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  e.target.style.boxShadow = "none";
                  e.target.style.transform = "translateY(0)";
                }}
              >
                Get Started
              </button>
            </div>
          </div>
        )}

        {/* Theme Picker Modal */}
        {showThemePicker && loaded && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            }}
            onClick={() => setShowThemePicker(false)}
          >
            <div
              style={{
                background: THEME.inputBg,
                border: `2px solid ${THEME.border}`,
                borderRadius: 12,
                padding: 16,
                maxWidth: 400,
                width: "90%",
                maxHeight: "auto",
                overflowY: "auto",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ margin: "0 0 6px 0", fontSize: 18, color: THEME.text }}>
                  Choose a Theme
                </h2>
                <p style={{ margin: "0", fontSize: 11, opacity: 0.6, color: THEME.text }}>
                  Select your preferred color scheme
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {Object.entries(THEMES).map(([themeKey, themeObj]) => (
                  <button
                    key={themeKey}
                    onClick={() => {
                      setTheme(themeKey);
                      setShowThemePicker(false);
                      setTimeout(() => setShowNewConversationModal(true), 100);
                    }}
                    style={{
                      padding: 16,
                      background: themeKey === theme 
                        ? `linear-gradient(180deg, ${themeObj.accentLight} 0%, ${themeObj.accentDark} 100%)`
                        : themeObj.inputBg,
                      border: themeKey === theme 
                        ? `2px solid ${themeObj.accentLight}`
                        : `1px solid ${themeObj.border}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onMouseEnter={e => {
                      if (themeKey !== theme) {
                        e.target.style.borderColor = themeObj.accentLight;
                        e.target.style.transform = "translateY(-2px)";
                        e.target.style.boxShadow = `0 4px 12px ${themeObj.accent}40`;
                      }
                    }}
                    onMouseLeave={e => {
                      if (themeKey !== theme) {
                        e.target.style.borderColor = themeObj.border;
                        e.target.style.transform = "translateY(0)";
                        e.target.style.boxShadow = "none";
                      }
                    }}
                  >
                    <div style={{ 
                      display: "flex", 
                      gap: 6, 
                      marginBottom: 8,
                      flexWrap: "wrap",
                    }}>
                      <div style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: themeObj.bg,
                        border: `1px solid ${themeObj.text}40`,
                      }}/>
                      <div style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: themeObj.accent,
                        border: `1px solid ${themeObj.text}40`,
                      }}/>
                      <div style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: themeObj.inputBg,
                        border: `1px solid ${themeObj.text}40`,
                      }}/>
                    </div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: themeKey === theme ? 600 : 500,
                      color: themeKey === theme ? themeObj.buttonText : themeObj.text,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {themeObj.name}
                    </div>
                    {themeKey === theme && (
                      <div style={{
                        marginTop: 8,
                        fontSize: 11,
                        color: themeObj.buttonText,
                        textAlign: "center",
                        fontWeight: 600,
                      }}>
                        ✓ Active
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Start New Conversation Modal */}
        {false && showNewConversationModal && !showThemePicker && loaded && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3000,
            }}
            onClick={() => setShowNewConversationModal(false)}
          >
            <div
              style={{
                background: THEME.inputBg,
                border: `2px solid ${THEME.border}`,
                borderRadius: 16,
                padding: 32,
                maxWidth: 500,
                width: "90%",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
              }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{
                margin: "0 0 8px 0",
                fontSize: 24,
                fontWeight: 700,
                color: THEME.text,
              }}>
                Start a New Conversation
              </h2>
              <p style={{
                margin: "0 0 20px 0",
                fontSize: 13,
                color: THEME.text,
                opacity: 0.7,
              }}>
                What would you like to talk about?
              </p>

              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type your message here..."
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: THEME.inputBgLight,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 8,
                  color: THEME.text,
                  fontSize: 14,
                  outline: "none",
                  transition: "all 0.2s",
                  boxSizing: "border-box",
                  minHeight: "100px",
                  resize: "none",
                  fontFamily: "inherit",
                }}
                onFocus={e => {
                  e.target.style.borderColor = THEME.accentLight;
                  e.target.style.boxShadow = `0 0 0 2px ${THEME.accent}20`;
                }}
                onBlur={e => {
                  e.target.style.borderColor = THEME.border;
                  e.target.style.boxShadow = "none";
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" && e.ctrlKey && input.trim()) {
                    sendMessage();
                    setShowNewConversationModal(false);
                  }
                }}
              />

              <div style={{
                display: "flex",
                gap: 12,
                marginTop: 20,
                justifyContent: "flex-end",
              }}>
                <button
                  onClick={() => setShowNewConversationModal(false)}
                  style={{
                    padding: "10px 24px",
                    background: THEME.inputBgDark,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: 8,
                    color: THEME.text,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = THEME.accentLight;
                    e.currentTarget.style.boxShadow = `0 4px 12px ${THEME.accent}40`;
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = THEME.border;
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    if (input.trim()) {
                      sendMessage();
                      setShowNewConversationModal(false);
                    }
                  }}
                  disabled={!input.trim() || loading}
                  style={{
                    padding: "10px 24px",
                    background: input.trim() && !loading 
                      ? `linear-gradient(180deg, ${THEME.accentLight} 0%, ${THEME.accentDark} 100%)`
                      : THEME.inputBgDark,
                    border: "none",
                    borderRadius: 8,
                    color: input.trim() && !loading ? "white" : THEME.text,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                    transition: "all 0.2s",
                    opacity: input.trim() && !loading ? 1 : 0.6,
                  }}
                  onMouseEnter={e => {
                    if (input.trim() && !loading) {
                      e.currentTarget.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  {loading ? "Sending..." : "Start Chat"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Profile Selection Modal */}
        {showProfileModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            }}
            onClick={() => setShowProfileModal(false)}
          >
            <div
              style={{
                background: THEME.inputBg,
                border: `2px solid ${THEME.border}`,
                borderRadius: 12,
                padding: 24,
                maxWidth: 400,
                width: "90%",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: "0 0 8px 0", fontSize: 20, color: THEME.text }}>
                  {userProfile ? "Switch Profile" : "Select Profile"}
                </h2>
                <p style={{ margin: "0", fontSize: 12, opacity: 0.6, color: THEME.text }}>
                  Choose your account type
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Free Profile */}
                <div
                  onClick={() => {
                    localStorage.setItem('circuitbot_user_type', 'free');
                    setUserProfile({ type: 'free', name: 'Free User' });
                    setIsLoggedIn(true);
                    setShowProfileModal(false);
                  }}
                  style={{
                    padding: 16,
                    background: userProfile?.type === 'free' ? THEME.accent : THEME.bg,
                    color: userProfile?.type === 'free' ? THEME.buttonText : THEME.text,
                    border: `1px solid ${userProfile?.type === 'free' ? THEME.accent : THEME.border}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    if (userProfile?.type !== 'free') {
                      e.currentTarget.style.background = THEME.inputBg;
                    }
                  }}
                  onMouseLeave={e => {
                    if (userProfile?.type !== 'free') {
                      e.currentTarget.style.background = THEME.bg;
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "#888",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      fontWeight: "bold",
                      color: "#000",
                    }}>
                      F
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                        Free
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Basic features and access
                      </div>
                    </div>
                    {userProfile?.type === 'free' && <div style={{ fontSize: 18 }}>✓</div>}
                  </div>
                </div>

                {/* Premium Profile */}
                <div
                  onClick={() => {
                    localStorage.setItem('circuitbot_user_type', 'premium');
                    setUserProfile({ type: 'premium', name: 'Premium User' });
                    setIsLoggedIn(true);
                    setShowProfileModal(false);
                  }}
                  style={{
                    padding: 16,
                    background: userProfile?.type === 'premium' ? "#29a329" : THEME.bg,
                    color: userProfile?.type === 'premium' ? "white" : THEME.text,
                    border: `1px solid ${userProfile?.type === 'premium' ? "#29a329" : THEME.border}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    if (userProfile?.type !== 'premium') {
                      e.currentTarget.style.background = THEME.inputBg;
                    }
                  }}
                  onMouseLeave={e => {
                    if (userProfile?.type !== 'premium') {
                      e.currentTarget.style.background = THEME.bg;
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "#29a329",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      fontWeight: "bold",
                      color: "white",
                    }}>
                      P
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                        Premium
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Advanced features and priority support
                      </div>
                    </div>
                    {userProfile?.type === 'premium' && <div style={{ fontSize: 18 }}>✓</div>}
                  </div>
                </div>

                {/* Developer Profile */}
                <div
                  onClick={() => {
                    localStorage.setItem('circuitbot_user_type', 'developer');
                    setUserProfile({ type: 'developer', name: 'Martel Storm' });
                    setIsLoggedIn(true);
                    setShowProfileModal(false);
                  }}
                  style={{
                    padding: 16,
                    background: userProfile?.type === 'developer' ? "#ffd700" : THEME.bg,
                    color: userProfile?.type === 'developer' ? "#000" : THEME.text,
                    border: `1px solid ${userProfile?.type === 'developer' ? "#ffd700" : THEME.border}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    if (userProfile?.type !== 'developer') {
                      e.currentTarget.style.background = THEME.inputBg;
                    }
                  }}
                  onMouseLeave={e => {
                    if (userProfile?.type !== 'developer') {
                      e.currentTarget.style.background = THEME.bg;
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "#ffd700",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      fontWeight: "bold",
                      color: "#000",
                    }}>
                      M
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                        Developer
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Martel Storm - Full access
                      </div>
                    </div>
                    {userProfile?.type === 'developer' && <div style={{ fontSize: 18 }}>✓</div>}
                  </div>
                </div>
              </div>

              {userProfile && (
                <button
                  onClick={() => {
                    localStorage.removeItem('circuitbot_user_type');
                    localStorage.removeItem('circuitbot_seen_prototype');
                    setUserProfile(null);
                    setIsLoggedIn(false);
                    setShowProfileModal(false);
                  }}
                  style={{
                    width: "100%",
                    marginTop: 16,
                    padding: "10px",
                    background: "transparent",
                    border: `1px solid ${THEME.border}`,
                    color: "#ff4444",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = "#ff4444";
                    e.target.style.color = "white";
                    e.target.style.borderColor = "#ff4444";
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = "transparent";
                    e.target.style.color = "#ff4444";
                    e.target.style.borderColor = THEME.border;
                  }}
                >
                  Log Out
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sidebar Resize Handle */}
        <div
          onMouseDown={() => setIsResizing(true)}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 4,
            cursor: "col-resize",
            background: isResizing ? THEME.accent : "transparent",
            transition: "background 0.2s",
          }}
          title="Drag to resize sidebar"
        />
      </div>

      {/* Main Chat Area */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Messages area */}
        <div 
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.style.backgroundColor = THEME.bg + "60";
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.style.backgroundColor = "transparent";
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFileSelect(e.dataTransfer.files);
            }
          }}
          style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          {messages.length === 0 ? (
            <div style={{
              textAlign: "center",
              margin: "auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              padding: "20px",
            }}>
              <div style={{
                fontSize: "18px",
                color: THEME.text.secondary,
                fontWeight: "500",
              }}>
                No chats yet
              </div>
              <div style={{
                fontSize: "14px",
                color: THEME.text.tertiary,
                maxWidth: "400px",
              }}>
                Send a message below to start a conversation with your AI assistant
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const content = typeof msg.content === 'string' 
                ? msg.content 
                : msg.content?.text || JSON.stringify(msg.content);
              
              const displayContent = msg.role === "assistant" ? formatMessage(content) : content;
              
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent:
                      msg.role === "user" ? "flex-end" : "flex-start",
                  }}>
                  <div style={{ maxWidth: "60%" }}>
                    <div
                      style={{
                        padding: "12px 16px",
                        borderRadius: 12,
                        background:
                          msg.role === "user" 
                            ? `linear-gradient(180deg, ${THEME.accentLight} 0%, ${THEME.accentDark} 100%)` 
                            : `linear-gradient(180deg, ${THEME.inputBgLight} 0%, ${THEME.inputBgDark} 100%)`,
                        color:
                          msg.role === "user"
                            ? "#ffffff"
                            : THEME.text,
                        wordWrap: "break-word",
                        lineHeight: 1.5,
                      }}>
                      {displayContent}
                    </div>
                    
                    {/* Response time and feedback for assistant messages */}
                    {msg.role === "assistant" && (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginTop: 6,
                        paddingLeft: 4,
                        fontSize: 12,
                        opacity: 0.6,
                      }}>
                        {msg.responseTime && (
                          <span>{msg.responseTime}s</span>
                        )}
                        {msg.model && (
                          <span style={{ fontSize: 11 }}>({msg.model})</span>
                        )}
                        {msg.sources && msg.sources.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, opacity: 0.7 }}>Sources:</span>
                            {msg.sources.map((source, idx) => (
                              <a
                                key={idx}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: 11,
                                  color: THEME.accentLight,
                                  textDecoration: "none",
                                  borderBottom: `1px solid ${THEME.accentLight}`,
                                  opacity: 0.8,
                                  transition: "opacity 0.2s",
                                }}
                                onMouseEnter={e => e.target.style.opacity = 1}
                                onMouseLeave={e => e.target.style.opacity = 0.8}
                              >
                                [{idx + 1}]
                              </a>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                          {/* Refresh button for any assistant message */}
                          <button
                            onClick={() => regenerateMessage(idx)}
                            style={{
                              background: "transparent",
                              border: `1.5px solid ${THEME.border}`,
                              borderRadius: 4,
                              cursor: "pointer",
                              padding: "5px 8px",
                              color: THEME.text,
                              fontSize: 12,
                              fontWeight: 600,
                              transition: "all 0.2s",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = THEME.accent;
                              e.currentTarget.style.color = THEME.accentLight;
                              e.currentTarget.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                              e.currentTarget.style.transform = "translateY(-2px)";
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = THEME.border;
                              e.currentTarget.style.color = THEME.text;
                              e.currentTarget.style.boxShadow = "none";
                              e.currentTarget.style.transform = "translateY(0)";
                            }}
                            title="Refresh this response"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="23 4 23 10 17 10"></polyline>
                              <polyline points="1 20 1 14 7 14"></polyline>
                              <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"></path>
                              <path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleFeedback(idx, "up")}
                            style={{
                              background: msg.feedback === "up" ? THEME.accent : "transparent",
                              border: `1.5px solid ${msg.feedback === "up" ? THEME.accent : THEME.border}`,
                              borderRadius: 4,
                              cursor: "pointer",
                              padding: "5px 10px",
                              color: msg.feedback === "up" ? THEME.buttonText : THEME.text,
                              fontSize: 12,
                              fontWeight: 600,
                              transition: "all 0.2s",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            onMouseEnter={e => {
                              if (msg.feedback !== "up") {
                                e.target.style.borderColor = THEME.accent;
                                e.target.style.color = THEME.accent;
                                e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                                e.target.style.transform = "translateY(-2px)";
                              }
                            }}
                            onMouseLeave={e => {
                              if (msg.feedback !== "up") {
                                e.target.style.borderColor = THEME.border;
                                e.target.style.color = THEME.text;
                                e.target.style.boxShadow = "none";
                                e.target.style.transform = "translateY(0)";
                              }
                            }}
                            title="Good response"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleFeedback(idx, "down")}
                            style={{
                              background: msg.feedback === "down" ? "#ff4444" : "transparent",
                              border: `1.5px solid ${msg.feedback === "down" ? "#ff4444" : THEME.border}`,
                              borderRadius: 4,
                              cursor: "pointer",
                              padding: "5px 10px",
                              color: msg.feedback === "down" ? "#fff" : THEME.text,
                              fontSize: 12,
                              fontWeight: 600,
                              transition: "all 0.2s",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            onMouseEnter={e => {
                              if (msg.feedback !== "down") {
                                e.target.style.borderColor = "#ff4444";
                                e.target.style.color = "#ff4444";
                                e.target.style.boxShadow = "0 4px 12px #ff444460";
                                e.target.style.transform = "translateY(-2px)";
                              }
                            }}
                            onMouseLeave={e => {
                              if (msg.feedback !== "down") {
                                e.target.style.borderColor = THEME.border;
                                e.target.style.color = THEME.text;
                                e.target.style.boxShadow = "none";
                                e.target.style.transform = "translateY(0)";
                              }
                            }}
                            title="Bad response"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {transcription && (
            <div style={{
              display: "flex",
              justifyContent: "flex-end",
            }}>
              <div style={{
                padding: "12px 16px",
                borderRadius: 12,
                background: `linear-gradient(180deg, ${THEME.accentLight} 0%, ${THEME.accentDark} 100%)`,
                color: "#ffffff",
                maxWidth: "60%",
                wordWrap: "break-word",
                lineHeight: 1.5,
                opacity: 0.8,
                fontStyle: "italic",
              }}>
                {transcription}
              </div>
            </div>
          )}
          {loading && (
            <div style={{
              display: "flex",
              justifyContent: "flex-start",
            }}>
              <div style={{
                padding: "12px 16px",
                borderRadius: 12,
                background: THEME.inputBg,
                color: THEME.text,
              }}>
                Thinking...
              </div>
            </div>
          )}
          {/* Inline A/B choice panel inside the scrollable feed */}
          {abOptions && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}>
                {/* Variant A */}
                <div style={{
                  padding: 12,
                  borderRadius: 8,
                  background: `linear-gradient(180deg, ${THEME.inputBgLight} 0%, ${THEME.inputBgDark} 100%)`,
                  border: `1px solid ${THEME.border}`,
                }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>A • {abOptions.a.style}</div>
                  <div>{formatMessage(abOptions.a.text)}</div>
                </div>
                {/* Variant B */}
                <div style={{
                  padding: 12,
                  borderRadius: 8,
                  background: `linear-gradient(180deg, ${THEME.inputBgLight} 0%, ${THEME.inputBgDark} 100%)`,
                  border: `1px solid ${THEME.border}`,
                }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>B • {abOptions.b.style}</div>
                  <div>{formatMessage(abOptions.b.text)}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>Model: {abOptions.model} • {abOptions.responseTime}s</div>
              {/* Footer action row: both choices on the same level at the bottom */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button onClick={() => commitChosenVariant('A')} style={{
                  padding: '8px 12px',
                  background: `linear-gradient(180deg, ${THEME.accentLight} 0%, ${THEME.accentDark} 100%)`,
                  border: 'none',
                  color: THEME.buttonText,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => {
                    e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                    e.target.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.target.style.boxShadow = "none";
                    e.target.style.transform = "translateY(0)";
                  }}>Choose A</button>
                <button onClick={() => commitChosenVariant('B')} style={{
                  padding: '8px 12px',
                  background: `linear-gradient(180deg, ${THEME.accentLight} 0%, ${THEME.accentDark} 100%)`,
                  border: 'none',
                  color: THEME.buttonText,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => {
                    e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                    e.target.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.target.style.boxShadow = "none";
                    e.target.style.transform = "translateY(0)";
                  }}>Choose B</button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        

        {/* Input area */}
        <div style={{
          padding: "16px 20px",
          borderTop: `1px solid ${THEME.border}`,
          background: "#424850",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>

          {/* Screen Sharing Status */}
          {screenSharing && (
            <div style={{
              padding: "8px 12px",
              background: "rgba(61, 214, 61, 0.1)",
              border: `1px solid ${THEME.accentLight}`,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: THEME.accentLight,
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: THEME.accentLight,
                animation: "pulse 1.5s infinite",
              }}></div>
              <span>Screen sharing active - AI can see {screenImages.length} frame{screenImages.length !== 1 ? 's' : ''}</span>
            </div>
          )}

            {/* Message input row with share/attach to the left of textarea */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}>
            {/* First row: Share Screen and Attach File buttons on the left, Textarea in center */}
            <div style={{
              display: "flex",
              gap: 12,
              alignItems: "stretch",
            }}>
            {/* Share Screen and Attach File buttons side by side */}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", height: "100%" }}>
              <button
                onClick={() => setScreenSharing(!screenSharing)}
                style={{
                  height: "46px",
                  padding: "0 14px",
                  background: screenSharing ? "linear-gradient(180deg, #ff6666 0%, #cc0000 100%)" : "#303540",
                  border: `1px solid ${screenSharing ? "#ff4444" : THEME.accent}`,
                  color: THEME.buttonText,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={e => {
                  if (!screenSharing) {
                    e.target.style.color = THEME.accentLight;
                    e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                    e.target.style.transform = "translateY(-2px)";
                    const svg = e.target.querySelector('svg');
                    if (svg) svg.style.stroke = THEME.accentLight;
                  } else {
                    e.target.style.color = "white";
                    const svg = e.target.querySelector('svg');
                    if (svg) svg.style.stroke = "white";
                  }
                }}
                onMouseLeave={e => {
                  if (!screenSharing) {
                    e.target.style.color = THEME.buttonText;
                    e.target.style.boxShadow = "none";
                    e.target.style.transform = "translateY(0)";
                    const svg = e.target.querySelector('svg');
                    if (svg) svg.style.stroke = "white";
                  }
                }}
                title="Toggle screen sharing"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                  <rect x="2" y="4" width="20" height="14" rx="3"/>
                  <path d="M8 20h8"/>
                  <path d="M12 16v4"/>
                </svg>
                Share Screen
              </button>
              <button
                onClick={handleAttachClick}
                style={{
                  height: "46px",
                  padding: "0 14px",
                  background: "#303540",
                  border: `1px solid ${THEME.accent}`,
                  color: THEME.buttonText,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={e => {
                  e.target.style.color = THEME.accentLight;
                  e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                  e.target.style.transform = "translateY(-2px)";
                  const svg = e.target.querySelector('svg');
                  if (svg) svg.style.stroke = THEME.accentLight;
                }}
                onMouseLeave={e => {
                  e.target.style.color = THEME.buttonText;
                  e.target.style.boxShadow = "none";
                  e.target.style.transform = "translateY(0)";
                  const svg = e.target.querySelector('svg');
                  if (svg) svg.style.stroke = "white";
                }}
                title="Attach file"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                  <path d="M21.44 11.05l-8.49 8.49a5 5 0 0 1-7.07-7.07l8.49-8.49a3 3 0 0 1 4.24 4.24l-8.49 8.49a1 1 0 0 1-1.41-1.41l8.49-8.49"/>
                </svg>
                Attach File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>

            {/* Message input */}
            <textarea
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onKeyPress={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.backgroundColor = THEME.inputBg + "40";
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.currentTarget.style.backgroundColor = THEME.inputBg;
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.backgroundColor = THEME.inputBg;
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleFileSelect(e.dataTransfer.files);
                }
              }}
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: "12px 16px",
                background: THEME.inputBg,
                border: "1px solid #fff",
                borderRadius: 8,
                color: "#fff",
                fontFamily: "inherit",
                fontSize: 14,
                outline: "none",
                minWidth: 0,
                minHeight: "36px",
                maxHeight: "200px",
                resize: "none",
                overflowY: "hidden",
                height: "auto",
                boxSizing: "border-box",
              }}
              disabled={loading}
              rows={1}
            />

            {/* Textarea row - contains textarea with share/attach on left */}
            </div>

            {/* Second row: Voice controls and Send button */}
            <div style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}>
              {/* Voice Controls Group */}
              <div style={{ display: "flex", gap: 8 }}>
                {/* Always-On Mic Toggle Button */}
                <button 
                  onClick={async () => {
                    // If turning OFF the mic and there's transcription, send it
                    if (micOpen) {
                      // Stop recognition immediately to capture any final text
                      if (recognitionRef.current) {
                        recognitionRef.current.stop();
                      }
                      
                      // Wait a moment for speech recognition to finalize
                      await new Promise(resolve => setTimeout(resolve, 100));
                      
                      // Get final transcription - combine accumulated + current state
                      let finalTranscription = accumulatedTranscriptRef.current.trim();
                      if (!finalTranscription && transcription.trim()) {
                        finalTranscription = transcription.trim();
                      } else if (finalTranscription && transcription.trim() && !transcription.includes(finalTranscription)) {
                        finalTranscription = finalTranscription + " " + transcription.trim();
                      }
                      
                      accumulatedTranscriptRef.current = ""; // Clear for next use
                      
                      if (finalTranscription) {
                        // Create user message from the transcription
                        const userMessage = { role: "user", content: finalTranscription };
                        const newMessages = [...messages, userMessage];
                        setMessages(newMessages);
                        setTranscription("");
                        setLoading(true);
                        
                        // Send to AI
                        const modelToUse = useAutoModel ? selectBestModel(finalTranscription) : selectedModel;
                        const startTime = Date.now();
                        
                        try {
                          const response = await fetch(`${API_BASE}/chat`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              messages: newMessages,
                              model: modelToUse,
                              profileGuide: activeProfile?.guide || "",
                              userId,
                              userContext: { name: null, projects: [], interests: [] },
                              deepResearch,
                              currentDateTime: new Date().toISOString(),
                            }),
                          });
                          
                          const endTime = Date.now();
                          const responseTime = ((endTime - startTime) / 1000).toFixed(2);
                          
                          if (response.ok) {
                            const data = await response.json();
                            const text = data.reply || "";
                            const sources = extractSources(text);
                            const assistantMessage = {
                              role: "assistant",
                              content: text,
                              responseTime: responseTime,
                              model: data.model || modelToUse,
                              feedback: null,
                              sources: sources.length ? sources : null,
                            };
                            const updatedMessages = [...newMessages, assistantMessage];
                            setMessages(updatedMessages);
                            setChats(prev => prev.map(chat => chat.id === currentChatId ? { ...chat, messages: updatedMessages } : chat));
                          }
                        } catch (error) {
                          console.error("Error sending Always-On Mic message:", error);
                        } finally {
                          setLoading(false);
                        }
                      }
                      
                      // Toggle the mic state
                      setMicOpen(!micOpen);
                    } else {
                      // If mic is already off, just toggle it on
                      setMicOpen(!micOpen);
                    }
                  }}
                    style={{
                      height: "46px",
                      padding: "0 16px",
                      background: !micOpen ? `linear-gradient(180deg, ${THEME.accentLight} 0%, ${THEME.accentDark} 100%)` : "#ff4444",
                      border: "none",
                      color: "white",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      transition: "all 0.2s",
                      minWidth: 120,
                      display: "flex",
                      alignItems: "center",
                    }}
                  onMouseEnter={e => {
                    e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                    e.target.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.target.style.boxShadow = "none";
                    e.target.style.transform = "translateY(0)";
                  }}
                  title={micOpen ? "Click to disable always-on microphone" : "Click to enable always-on microphone"}
                >
                  {!micOpen ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}>
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" x2="12" y1="19" y2="22"/>
                      </svg>
                      Enable Always-On Mic
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}>
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" x2="12" y1="19" y2="22"/>
                      </svg>
                      Listening
                    </>
                  )}
                </button>

                {/* Hold to Talk */}
                <button
                  onMouseDown={() => {
                    setIsListening(true);
                    setTranscription("");
                    console.log("[voice] listening...");
                  }}
                  onMouseUp={async () => {
                    setIsListening(false);
                    // Stop recognition immediately
                    if (recognitionRef.current) {
                      recognitionRef.current.stop();
                    }
                    console.log("[voice] auto-send");
                    // Wait a moment for final transcription to be captured
                    setTimeout(() => {
                      // Get accumulated transcript, or fall back to current transcription state
                      let finalTranscription = accumulatedTranscriptRef.current.trim();
                      if (!finalTranscription) {
                        finalTranscription = transcription.trim();
                      }
                      accumulatedTranscriptRef.current = ""; // Clear for next use
                      
                      if (finalTranscription) {
                        // Create a user message from the transcription
                        const userMessage = { role: "user", content: finalTranscription };
                        const newMessages = [...messages, userMessage];
                        setMessages(newMessages);
                        setTranscription("");
                        setLoading(true);

                        // Send to AI
                        const modelToUse = useAutoModel ? selectBestModel(finalTranscription) : selectedModel;
                        const startTime = Date.now();

                        const currentDateTime = new Date().toISOString();
                        const messagePayload = {
                          messages: newMessages,
                          model: modelToUse,
                          profileGuide: activeProfile?.guide || "",
                          userId,
                          userContext: { name: null, projects: [], interests: [] },
                          deepResearch,
                          currentDateTime,
                          voiceEnabled: voiceType === "alloy",
                          selectedVoice: voiceType === "alloy" ? voiceType : null,
                          voiceSpeed,
                        };
                        
                        if (screenImages.length > 0) {
                          messagePayload.screenImages = screenImages;
                          messagePayload.screenSharingActive = true;
                        }

                        fetch(`${API_BASE}/chat`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(messagePayload),
                        }).then(async response => {
                          const endTime = Date.now();
                          const responseTime = ((endTime - startTime) / 1000).toFixed(2);

                          if (response.ok) {
                            const data = await response.json();
                            const text = data.reply || "";
                            const audioUrl = data.audioUrl || null;
                            const sources = extractSources(text);
                            const assistantMessage = { 
                              role: "assistant", 
                              content: text,
                              responseTime: responseTime,
                              model: data.model || modelToUse,
                              feedback: null,
                              sources: sources.length ? sources : null,
                            };
                            const updatedMessages = [...newMessages, assistantMessage];
                            setMessages(updatedMessages);
                            setChats(prev => prev.map(chat => chat.id === currentChatId ? { ...chat, messages: updatedMessages } : chat));
                            
                            // Play audio response if AI voice is enabled and audioUrl is provided
                            if (voiceType === "alloy" && audioUrl) {
                              try {
                                const audio = new Audio(audioUrl);
                                audio.play().catch(e => console.error("Audio playback error:", e));
                              } catch (e) {
                                console.error("Audio playback setup error:", e);
                              }
                            }
                          }
                          setLoading(false);
                        }).catch(error => {
                          console.error("Error sending message:", error);
                          setLoading(false);
                        });
                      }
                    }, 100);
                  }}
                  onMouseEnter={e => {
                    if (!isListening) {
                      e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                      e.target.style.transform = "translateY(-2px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    setIsListening(false);
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  style={{
                    height: "46px",
                    padding: "0 14px",
                    background: isListening ? "#ff4444" : `linear-gradient(180deg, ${THEME.accentLight} 0%, ${THEME.accentDark} 100%)`,
                    border: "none",
                    color: "white",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    transition: "all 0.2s",
                    minWidth: 90,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Hold to record"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}>
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" x2="12" y1="19" y2="22"/>
                  </svg>
                  {isListening ? "Listening..." : "Hold to Talk"}
                </button>

                {/* Stop Button */}
                <button
                  onClick={() => {
                    setIsListening(false);
                    setStopClicked(true);
                    setTimeout(() => setStopClicked(false), 200);
                  }}
                  style={{
                    height: "46px",
                    padding: "0 14px",
                    background: stopClicked ? "linear-gradient(180deg, #ff6666 0%, #cc0000 100%)" : "#303540",
                    border: `1px solid #ff4444`,
                    color: "white",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    transition: "all 0.2s",
                    minWidth: 70,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                  onMouseEnter={e => {
                    if (!isListening) {
                      e.target.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                      e.target.style.transform = "translateY(-2px)";
                    }
                  }}
                  onMouseLeave={e => {
                    e.target.style.boxShadow = "none";
                    e.target.style.transform = "translateY(0)";
                  }}
                  title="Stop listening"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                  </svg>
                </button>
              </div>

              {/* Send Button */}
              <button
                onClick={sendMessage}
                style={{
                  height: "46px",
                  padding: "0 16px",
                  background: (input.trim() || attachedFiles.length > 0) ? `linear-gradient(180deg, ${THEME.accentLight} 0%, ${THEME.accentDark} 100%)` : "#303540",
                  color: THEME.buttonText,
                  border: `1px solid ${THEME.accent}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: "bold",
                  transition: "all 0.2s",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  marginLeft: "auto",
                }}
                onMouseEnter={e => {
                  if (input.trim() || attachedFiles.length > 0) {
                    e.currentTarget.style.boxShadow = `0 4px 12px ${THEME.accent}60`;
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}>
                Send
              </button>
            </div>

            {/* Attached Files Display - below the input row */}
            {attachedFiles.length > 0 && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "0 0",
              }}>
                {attachedFiles.map((file, index) => (
                  <div key={index} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: THEME.inputBg,
                    border: `1px solid ${THEME.accent}`,
                    borderRadius: 6,
                    fontSize: 12,
                    color: THEME.text,
                  }}>
                    <span>📎 {file.name}</span>
                    <button
                      onClick={() => removeAttachedFile(index)}
                      style={{
                        marginLeft: "auto",
                        background: "none",
                        border: "none",
                        color: THEME.accent,
                        cursor: "pointer",
                        padding: "4px 8px",
                        fontSize: 14,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

          {/* Additional controls can be added here if needed */}
          </div>
        </div>
      </div>
    </div>
  );
}
