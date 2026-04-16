import React, { createContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase/FirebaseConfig';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const signUp = async (email, password) => {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    const userData = {
      uid: res.user.uid,
      email: email,
      virtualBalance: 10000, // Logo ko sikhne ke liye $10,000 virtual cash
      portfolio: [],
      createdAt: new Date()
    };
    await setDoc(doc(db, "users", res.user.uid), userData);
    setUser(userData);
  };

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        setUser(snap.data());
      } else {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, signUp, login }}>
      {children}
    </AuthContext.Provider>
  );
};
