import { useSocketContext } from '../contexts/SocketContext.jsx';

export function useSocket() {
  return useSocketContext();
}
