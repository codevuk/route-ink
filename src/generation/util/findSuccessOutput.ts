import type { Endpoint } from "../../types/Endpoint.js";

export const findSuccessOutput = (response: Endpoint["response"]) => {
  if (!response) {
    return null;
  }

  const successStatus = Object.keys(response).find(status => status.startsWith("2"));

  if (!successStatus) {
    return null;
  }

  return response[Number(successStatus)];
}