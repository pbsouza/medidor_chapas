import { initializeApp, getApps, getApp } from 'firebase/app';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Suporte ao databaseId provisionado no projeto
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

// Inicializa autenticação silenciosa/anônima caso não esteja autenticado
signInAnonymously(auth).catch((err) => {
  console.warn('Auth anônima Firestore:', err);
});

// Validação de conexão inicial com o Firestore
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'settings', 'global_config'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration or network status.');
    }
  }
}

testConnection();

export { firebaseConfig };

