import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

// Replace these values with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyBefuNSd2j9CJJ92EWcg0am9s3zBSSHS4Y",
  authDomain: "study-64ebf.firebaseapp.com",
  projectId: "study-64ebf",
  storageBucket: "study-64ebf.firebasestorage.app",
  messagingSenderId: "53040624855",
  appId: "1:53040624855:web:ec3ffb04513bc2237fac92",
  measurementId: "G-L1SZKG6Y2J"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Принудительный long-polling вместо потокового канала.
//
// Автоопределение (experimentalAutoDetectLongPolling) здесь уже стояло — и не
// спасло: оно проверяет сеть один раз при старте, а школьный/офисный Wi-Fi с
// инспекцией трафика пропускает начало потока и убивает его ПОЗЖЕ. В консоли
// это выглядело как «Fetch API cannot load .../Listen/channel ... due to
// access control checks» после сотен успешно доставленных событий — и все
// живые списки у менеджеров зависали в вечном переподключении.
//
// Long-polling — обычные короткие XHR-запросы, их такие сети не трогают.
// Цена: чуть больше задержка у живых обновлений. Для наших экранов (списки
// заявок, контактов, сотрудников) это незаметно, а «работает всегда» важнее.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
