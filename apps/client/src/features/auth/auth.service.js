import ky from 'ky';
import { atom } from 'nanostores';

/** @typedef {import('./auth.schemas').Auth} Auth */
/** @type {Auth | null} */
const auth = null;
export const authStore = atom(auth);

/**
 * Obtiene un nuevo access token usando el refresh token
 * @returns {Promise<Auth['accessToken']>} El nuevo access token
 */
const getAccessToken = async () => {
  const data = await ky.get('/api/auth/refresh').json();
  return data;
};

/**
 * Crea una instancia de ky con el access token en los headers y un hook para refrescar el token si es necesario
 * @returns {import('ky').KyInstance} La instancia de ky
 */
export const getPrivateKy = () => {
  return ky.create({
    headers: {
      Authorization: `Bearer ${authStore.get()?.accessToken}`,
    },
    retry: {
      limit: 3,
      statusCodes: [403, 401],
    },
    hooks: {
      beforeRetry: [
        async ({ request, _options, error, _retryCount }) => {
          if (error.response.status === 403 || error.response.status === 401) {
            const { accessToken } = await getAccessToken();
            request.headers.set('Authorization', `Bearer ${accessToken}`);
            authStore.set({ ...authStore.get(), accessToken });
          }
        },
      ],
    },
  });
};

/**
 * Obtiene el usuario que inicio sesión
 */
const getLoggedUser = async () => {
  const privateKy = getPrivateKy();
  const data = await privateKy.get('/api/auth/user').json();
  return data;
};

/**
 * Cierra la sesión del usuario actual
 */
const signOut = async () => {
  const privateKy = getPrivateKy();
  await privateKy.post('/api/auth/signout');
  authStore.set(null);
};

const authService = { getLoggedUser, signOut };
export default authService;
