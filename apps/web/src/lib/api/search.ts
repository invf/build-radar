import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface EdrpouCompany {
  edrpou: string
  name: string
  full_name: string
  address: string
  status: string
  registration_date: string
  ceo: string
  activity: string
  phone: string
  email: string
  website: string
}

export interface OsmPlace {
  osm_id: string
  osm_type: string
  display_name: string
  name: string
  address: string
  city: string
  oblast: string
  lat: number
  lng: number
  type: string
  category: string
  floors: number | null
  building_type: string
}

export const searchApi = {
  async searchCompanies(q: string, limit = 10): Promise<EdrpouCompany[]> {
    const { data } = await axios.get(`${API}/api/v1/search/companies`, {
      params: { q, limit },
    })
    return data.items ?? []
  },

  async getCompanyByEdrpou(edrpou: string): Promise<EdrpouCompany | null> {
    try {
      const { data } = await axios.get(`${API}/api/v1/search/company/${edrpou}`)
      return data
    } catch {
      return null
    }
  },

  async searchPlaces(q: string, limit = 10): Promise<OsmPlace[]> {
    const { data } = await axios.get(`${API}/api/v1/search/places`, {
      params: { q, limit },
    })
    return data.items ?? []
  },

  async searchBuildingsNearby(lat: number, lng: number, radius = 300): Promise<OsmPlace[]> {
    const { data } = await axios.get(`${API}/api/v1/search/buildings/nearby`, {
      params: { lat, lng, radius },
    })
    return data.items ?? []
  },

  async reverseGeocode(lat: number, lng: number): Promise<OsmPlace | null> {
    try {
      const { data } = await axios.get(`${API}/api/v1/search/reverse`, {
        params: { lat, lng },
      })
      return data
    } catch {
      return null
    }
  },
}
