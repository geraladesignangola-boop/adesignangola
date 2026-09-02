import { supabase } from './supabase.js'

export const Auth = {
  currentUser: null,

  async init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { data: perfil } = await supabase
        .from('utilizadores')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (perfil && perfil.ativo) {
        this.currentUser = { ...session.user, ...perfil }
        return true
      }
    }
    return false
  },

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      throw new Error('Credenciais inválidas')
    }

    const { data: perfil } = await supabase
      .from('utilizadores')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (!perfil || !perfil.ativo) {
      await supabase.auth.signOut()
      throw new Error('Utilizador inativo ou não encontrado')
    }

    this.currentUser = { ...data.user, ...perfil }
    return this.currentUser
  },

  async logout() {
    await supabase.auth.signOut()
    this.currentUser = null
  },

  async criarUtilizador(nome, email, password, role = 'operador') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome, role }
      }
    })

    if (error) throw error

    const { error: insertError } = await supabase
      .from('utilizadores')
      .insert({
        id: data.user.id,
        nome,
        email,
        role,
        ativo: true
      })

    if (insertError) throw insertError

    return data.user
  },

  isAdmin() {
    return this.currentUser?.role === 'admin'
  },

  isOperador() {
    return ['admin', 'operador'].includes(this.currentUser?.role)
  }
}
