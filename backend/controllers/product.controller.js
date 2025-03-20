import { json } from "express"
import { redis } from "../lib/redis.js"
import Product from "../models/product.model.js"

export const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find({})
        res.json(products)
    } catch (error) {
        console.log("Error in get all products", error.message)
        res.status(500).json({message: "server error", error: error.message})
    }
}

export const getFeaturedProducts = async (req, res) => {
    try {
        // try to get data from redis
        let featuredProducts = await redis.get("featured_product")
        if (featuredProducts) {
            return res.json(JSON.parse(featuredProducts))
        }

        // if redis can't provide then get it from mongodb
        featuredProducts = await Product.find({ isFeatured: true }).lean()

        // store it in redis
        await redis.set("featured_product", JSON.stringify(featuredProducts))
        res.json(featuredProducts)
    } catch (error) {
        console.log("Error in get featured products", error.message)
        res.status(500).json({message: "server error", error: error.message})
    }
}