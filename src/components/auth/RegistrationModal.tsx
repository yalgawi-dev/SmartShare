'use client';

import { useState } from 'react';
import { useAuth } from '../../app/context/AuthContext';
import styles from './RegistrationModal.module.css';

import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

// Decommissioned: Partner registration is handled exclusively by WelcomeGate
export default function RegistrationModal() {
  return null;
}
