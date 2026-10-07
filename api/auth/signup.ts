import { handleSignup } from '../../server/authSignup';

interface SignupRequest {
  method?: string;
  body?: unknown;
}

interface SignupResponse {
  status: (code: number) => SignupResponse;
  json: (body: { error?: string; message?: string }) => unknown;
}

export default function signup(req: SignupRequest, res: SignupResponse) {
  return handleSignup(req, res);
}
