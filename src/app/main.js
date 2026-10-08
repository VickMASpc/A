import { createApp } from './shell.js';
import { createFirebaseAuthService } from '../firebase/auth-service.js';
import '../styles/global.css';

const appRoot = document.querySelector('#app');

if (!(appRoot instanceof HTMLElement)) {
  throw new Error('The application root was not found.');
}

createApp(appRoot, createFirebaseAuthService());
