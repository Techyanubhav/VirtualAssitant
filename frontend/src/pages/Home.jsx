import React, { useContext, useEffect, useRef, useState } from 'react';
import { userDataContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import aiImg from "../assets/ai.gif";
import { CgMenuRight } from "react-icons/cg";
import { RxCross1 } from "react-icons/rx";
import userImg from "../assets/user.gif";

function Home() {
  const { userData, serverUrl, setUserData, getGeminiResponse } = useContext(userDataContext);
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");
  const [ham, setHam] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const cacheRef = useRef({});
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const isRecognizingRef = useRef(false);
  const lastTextRef = useRef("");
  const pauseListeningRef = useRef(false);
  const synth = window.speechSynthesis;

  const handleLogOut = async () => {
    try {
      await axios.get(`${serverUrl}/api/auth/logout`, { withCredentials: true });
      setUserData(null);
      navigate("/signin");
    } catch (error) {
      setUserData(null);
      console.log(error);
    }
  };

  const startRecognition = () => {
    if (!isSpeakingRef.current && !isRecognizingRef.current && !pauseListeningRef.current) {
      try {
        recognitionRef.current?.start();
      } catch (error) {
        if (error.name !== "InvalidStateError") {
          console.error("Start error:", error);
        }
      }
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(v => v.lang === 'hi-IN');
    if (hindiVoice) utterance.voice = hindiVoice;

    isSpeakingRef.current = true;
    utterance.onend = () => {
      setAiText("");
      isSpeakingRef.current = false;
      if (!pauseListeningRef.current && isMicOn) {
        setTimeout(() => {
          startRecognition();
        }, 1500);
      }
    };

    synth.cancel();
    synth.speak(utterance);
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    let isMounted = true;

    recognition.onstart = () => {
      isRecognizingRef.current = true;
      setListening(true);
    };

    recognition.onend = () => {
      isRecognizingRef.current = false;
      setListening(false);
      if (isMounted && !isSpeakingRef.current && !pauseListeningRef.current && isMicOn) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            if (e.name !== "InvalidStateError") console.error(e);
          }
        }, 1000);
      }
    };

    recognition.onerror = (event) => {
      isRecognizingRef.current = false;
      setListening(false);
      if (event.error !== "aborted" && isMounted && !isSpeakingRef.current && isMicOn) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            if (e.name !== "InvalidStateError") console.error(e);
          }
        }, 3000);
      }
    };

    recognition.onresult = async (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript.trim();
      if (transcript === lastTextRef.current) return;
      lastTextRef.current = transcript;

      setAiText("");
      setUserText(transcript);
      recognition.stop();
      isRecognizingRef.current = false;
      setListening(false);

      try {
        const data = await getGeminiResponse(transcript);
        const { type, userInput, response } = data;

        pauseListeningRef.current = true;

      if ([
  "google-search",
  "youtube-search",
  "youtube-play",
  "calculator-open",
  "instagram-open",
  "facebook-open",
  "weather-show",
  "wikipedia-search",
  "translate",
  "gmail-open",
  "maps-search",
  "news-search",
  "notepad-open",
  "currency-convert",
  "timer",
  "linkedin-open",
  "chatgpt-open"
].includes(type)) {
  const query = encodeURIComponent(userInput);
  const urlMap = {
    "google-search": `https://www.google.com/search?q=${query}`,
    "youtube-search": `https://www.youtube.com/results?search_query=${query}`,
    "youtube-play": `https://www.youtube.com/results?search_query=${query}`,
    "calculator-open": `https://www.google.com/search?q=calculator`,
    "instagram-open": `https://www.instagram.com/`,
    "facebook-open": `https://www.facebook.com/`,
    "weather-show": `https://www.google.com/search?q=weather`,
    "wikipedia-search": `https://en.wikipedia.org/wiki/Special:Search?search=${query}`,
    "translate": `https://translate.google.com/?sl=auto&tl=en&text=${query}&op=translate`,
    "gmail-open": `https://mail.google.com/`,
    "maps-search": `https://www.google.com/maps/search/${query}`,
    "news-search": `https://news.google.com/search?q=${query}`,
    "notepad-open": `https://anotepad.com/`,
    "currency-convert": `https://www.google.com/search?q=${query}+to+INR`,
    "timer": `https://www.google.com/search?q=timer`,
    "linkedin-open": `https://www.linkedin.com/`,
    "chatgpt-open": `https://chat.openai.com/`
  };
  window.open(urlMap[type], '_blank');
}

        cacheRef.current[transcript] = data;
        speak(response);
        setAiText(response);

        setTimeout(() => {
          pauseListeningRef.current = false;
          if (isMicOn) startRecognition();
        }, 3000);
      } catch (err) {
        console.error("AI error:", err);
        speak("Sorry, I couldn't understand that.");
        pauseListeningRef.current = false;
        if (isMicOn) startRecognition();
      }

      setUserText("");
    };

    const greeting = new SpeechSynthesisUtterance(`Hello ${userData.name}, what can I help you with?`);
    greeting.lang = 'hi-IN';
    window.speechSynthesis.speak(greeting);

    startRecognition();

    return () => {
      isMounted = false;
      recognition.stop();
      setListening(false);
      isRecognizingRef.current = false;
    };
  }, []);

  return (
    <div className='w-full h-[100vh] bg-gradient-to-t from-black to-[#02023d] flex justify-center items-center flex-col gap-[15px] overflow-hidden relative'>

      {/* Sidebar Toggle Icon */}
      {!ham && (
        <CgMenuRight className='text-white absolute top-[20px] right-[20px] w-[30px] h-[30px] z-50 cursor-pointer' onClick={() => setHam(true)} />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full bg-[#1a1a2e] w-[250px] z-40 p-4 transition-transform duration-300 ${ham ? "translate-x-0" : "translate-x-full"}`}>
        <RxCross1 className='text-white absolute top-[20px] left-[20px] w-[25px] h-[25px] cursor-pointer' onClick={() => setHam(false)} />
        <h2 className='text-white text-lg mb-6 font-bold mt-[60px]'>Menu</h2>
        <button className='w-full mb-3 py-2 px-4 bg-white rounded text-black font-semibold' onClick={handleLogOut}>Log Out</button>
        <button className='w-full mb-3 py-2 px-4 bg-white rounded text-black font-semibold' onClick={() => navigate("/customize")}>Customize Assistant</button>
      </div>

      <div className='w-[300px] h-[400px] flex justify-center items-center overflow-hidden rounded-4xl shadow-lg'>
        <img src={userData?.assistantImage} alt="" className='h-full object-cover' />
      </div>
      <h1 className='text-white text-[18px] font-semibold'>I'm {userData?.assistantName}</h1>

      {/* Mic Toggle */}
      <button
        onClick={() => {
          if (isMicOn) {
            recognitionRef.current?.stop();
            pauseListeningRef.current = true;
            setIsMicOn(false);
          } else {
            pauseListeningRef.current = false;
            startRecognition();
            setIsMicOn(true);
          }
        }}
        className="text-white text-[16px] bg-blue-600 px-4 py-2 rounded-full mt-2"
      >
        {isMicOn ? "🎤 Mic On" : "🔇 Mic Off"}
      </button>

      {!aiText && <img src={userImg} alt="" className='w-[200px] mt-4' />}
      {aiText && <img src={aiImg} alt="" className='w-[200px] mt-4' />}
      <h1 className='text-white text-[18px] font-semibold text-wrap text-center mt-2 px-4'>{userText || aiText || ""}</h1>
    </div>
  );
}

export default Home;
