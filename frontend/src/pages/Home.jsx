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
  const [chatHistory, setChatHistory] = useState([]);
  const [isMicOn, setIsMicOn] = useState(true);
  const cacheRef = useRef({});
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const [ham, setHam] = useState(false);
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
        console.log("Recognition requested to start");
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

    const startTimeout = setTimeout(() => {
      if (isMounted && !isSpeakingRef.current && !isRecognizingRef.current && isMicOn) {
        try {
          recognition.start();
          console.log("Recognition started after delay");
        } catch (e) {
          if (e.name !== "InvalidStateError") console.error(e);
        }
      }
    }, 10000);

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
            console.log("Recognition restarted");
          } catch (e) {
            if (e.name !== "InvalidStateError") console.error(e);
          }
        }, 1000);
      }
    };

    recognition.onerror = (event) => {
      console.warn("Recognition error:", event.error);
      isRecognizingRef.current = false;
      setListening(false);
      if (event.error !== "aborted" && isMounted && !isSpeakingRef.current && isMicOn) {
        setTimeout(() => {
          try {
            recognition.start();
            console.log("Recognition restarted after error");
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

      if (transcript.toLowerCase() === "stop listening") {
        if (isMicOn) {
          setIsMicOn(false);
          pauseListeningRef.current = true;
          speak("Okay, I will stop listening.");
        }
        return;
      }

      if (transcript.toLowerCase() === "start listening") {
        if (!isMicOn) {
          setIsMicOn(true);
          pauseListeningRef.current = false;
          speak("I'm listening now.");
          startRecognition();
        }
        return;
      }

      if (cacheRef.current[transcript]) {
        const cached = cacheRef.current[transcript];
        speak(cached.response);
        setAiText(cached.response);
        setChatHistory(prev => [...prev.slice(-4), { user: transcript, ai: cached.response }]);
        return;
      }

      try {
        const data = await getGeminiResponse(transcript);
        const { type, userInput, response } = data;

        pauseListeningRef.current = true;

        if (type === 'google-search') {
          window.open(`https://www.google.com/search?q=${encodeURIComponent(userInput)}`, '_blank');
        } else if (type === 'calculator-open') {
          window.open(`https://www.google.com/search?q=calculator`, '_blank');
        } else if (type === "instagram-open") {
          window.open(`https://www.instagram.com/`, '_blank');
        } else if (type === "facebook-open") {
          window.open(`https://www.facebook.com/`, '_blank');
        } else if (type === "weather-show") {
          window.open(`https://www.google.com/search?q=weather`, '_blank');
        } else if (type === 'youtube-search' || type === 'youtube-play' || type === 'youtube-open') {
          window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(userInput)}`, '_blank');
        } else if (type === 'linkedin-open') {
          window.open(`https://www.linkedin.com/`, '_blank');
        } else if (type === 'instagram-profile') {
          window.open(`https://www.instagram.com/${userInput}`, '_blank');
        } else if (type === 'linkedin-profile') {
          window.open(`https://www.linkedin.com/in/${userInput}`, '_blank');
        }

        cacheRef.current[transcript] = data;
        setChatHistory(prev => [...prev.slice(-4), { user: transcript, ai: response }]);
        speak(response);
        setAiText(response);

        setTimeout(() => {
          pauseListeningRef.current = false;
          if (isMicOn) startRecognition();
        }, 3000);

      } catch (err) {
        console.error("Error in AI response:", err);
        speak("Sorry, I couldn't understand that.");
        pauseListeningRef.current = false;
        if (isMicOn) startRecognition();
      }

      setUserText("");
    };

    const greeting = new SpeechSynthesisUtterance(`Hello ${userData.name}, what can I help you with?`);
    greeting.lang = 'hi-IN';
    window.speechSynthesis.speak(greeting);

    return () => {
      isMounted = false;
      clearTimeout(startTimeout);
      recognition.stop();
      setListening(false);
      isRecognizingRef.current = false;
    };
  }, []);

  return (
    <div className='w-full h-[100vh] bg-gradient-to-t from-[black] to-[#02023d] flex justify-center items-center flex-col gap-[15px] overflow-hidden'>
      {/* 🎤 Mic Toggle */}
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
        className="absolute top-[20px] left-[20px] text-white text-[16px] bg-blue-600 px-4 py-2 rounded-full z-50"
      >
        {isMicOn ? "🎤 Mic On" : "🔇 Mic Off"}
      </button>

      <CgMenuRight className='lg:hidden text-white absolute top-[20px] right-[20px] w-[25px] h-[25px]' onClick={() => setHam(true)} />
      <div className={`absolute lg:hidden top-0 w-full h-full bg-[#00000053] backdrop-blur-lg p-[20px] flex flex-col gap-[20px] items-start ${ham ? "translate-x-0" : "translate-x-full"} transition-transform`}>
        <RxCross1 className=' text-white absolute top-[20px] right-[20px] w-[25px] h-[25px]' onClick={() => setHam(false)} />
        <button className='min-w-[150px] h-[60px] text-black font-semibold bg-white rounded-full cursor-pointer text-[19px]' onClick={handleLogOut}>Log Out</button>
        <button className='min-w-[150px] h-[60px] text-black font-semibold bg-white rounded-full cursor-pointer text-[19px] px-[20px] py-[10px]' onClick={() => navigate("/customize")}>Customize your Assistant</button>
        <div className='w-full h-[2px] bg-gray-400'></div>
        <h1 className='text-white font-semibold text-[19px]'>History</h1>
        <div className='w-full h-[400px] gap-[20px] overflow-y-auto flex flex-col truncate'>
          {userData.history?.map((his, index) => (
            <div key={index} className='text-gray-200 text-[18px] w-full h-[30px]'>{his}</div>
          ))}
        </div>
      </div>

      <button className='min-w-[150px] h-[60px] mt-[30px] text-black font-semibold absolute hidden lg:block top-[20px] right-[20px] bg-white rounded-full cursor-pointer text-[19px]' onClick={handleLogOut}>Log Out</button>
      <button className='min-w-[150px] h-[60px] mt-[30px] text-black font-semibold bg-white absolute top-[100px] right-[20px] rounded-full cursor-pointer text-[19px] px-[20px] py-[10px] hidden lg:block' onClick={() => navigate("/customize")}>Customize your Assistant</button>

      <div className='w-[300px] h-[400px] flex justify-center items-center overflow-hidden rounded-4xl shadow-lg'>
        <img src={userData?.assistantImage} alt="" className='h-full object-cover' />
      </div>
      <h1 className='text-white text-[18px] font-semibold'>I'm {userData?.assistantName}</h1>

      {/* 📝 Chat History */}
      <div className="w-[90%] max-w-[600px] mt-4 bg-white/10 p-4 rounded-xl text-white">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold">Last 5 Commands</h2>
          <button
            onClick={() => setChatHistory([])}
            className="bg-red-500 text-white px-3 py-1 text-sm rounded-full hover:bg-red-600 transition"
          >
            🧹 Clear
          </button>
        </div>
        {chatHistory.length === 0 ? (
          <p className="text-gray-300 italic">No recent commands.</p>
        ) : (
          chatHistory.map((item, index) => (
            <div key={index} className="mb-2">
              <p><strong>You:</strong> {item.user}</p>
              <p><strong>AI:</strong> {item.ai}</p>
            </div>
          ))
        )}
      </div>

      {!aiText && <img src={userImg} alt="" className='w-[200px]' />}
      {aiText && <img src={aiImg} alt="" className='w-[200px]' />}
      <h1 className='text-white text-[18px] font-semibold text-wrap'>{userText ? userText : aiText ? aiText : null}</h1>
    </div>
  );
}

export default Home;
