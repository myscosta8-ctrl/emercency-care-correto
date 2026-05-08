export function getRoleHome(role: string): string {
  switch (role) {
    case "recepcionista":      return "/recepcao";
    case "tecnico_enfermagem": return "/vitais";
    case "assistente_social":  return "/social";
    case "nutricionista":      return "/nutricao";
    case "farmaceutico":       return "/laboratorio";
    case "laboratorio":        return "/laboratorio";
    case "medico":             return "/fila-medico";
    default:                   return "/";
  }
}
