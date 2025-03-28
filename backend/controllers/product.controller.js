import { json } from "express"
import { redis } from "../lib/redis.js"
import Product from "../models/product.model.js"
import cloudinary from "../lib/cloudinary.js"

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

export const createProduct = async (req, res) => {
    try {
        const { name, description, price, image, category } = req.body
        let cloudinaryResponse = null
        if (image) {
            cloudinaryResponse = await cloudinary.uploader.upload(image, {folder: "products"})
        }

        const product = await Product.create({
            name,
            description,
            price, 
            image: cloudinaryResponse?.secure_url ? cloudinaryResponse.secure_url : "",
            category,
        })

        res.status(201).json(product)
    } catch (error) {
        console.log("Error in create product controller", error.message)
        res.status(500).json({message: "server error", error: error.message})
    }
}

export const deleteProduct = async (req, res) => {
	try {
		const product = await Product.findById(req.params.id)
		if (!product) {
			return res.status(404).json({ message: "Product not found" })
		}

		if (product.image) {
			const publicId = product.image.split("/").pop().split(".")[0];
			try {
				await cloudinary.uploader.destroy(`products/${publicId}`)
				console.log("deleted image from cloduinary");
			} catch (error) {
				console.log("error deleting image from cloduinary", error);
			}
		}

		await Product.findByIdAndDelete(req.params.id);

		res.json({ message: "Product deleted successfully" });
	} catch (error) {
		console.log("Error in deleteProduct controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const getRecommendedProducts = async (req, res) => {
    try {
        const products = await Product.aggregate([
            {
                $sample: { size: 4 },
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    image: 1,
                    price: 1,
                },
            }
        ])
        res.json(products)
    } catch (error) {
        console.log("Error in getRecommendedProducts controller", error.message)
        res.status(500).json({ message: "server error", error: error.message })
    }
} 

export const getProductsByCategory = async (req, res) => {
	const { category } = req.params;
	try {
		const products = await Product.find({ category });
		res.json({ products });
	} catch (error) {
		console.log("Error in getProductsByCategory controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const toggleFeaturedProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
        if (product) {
            product.isFeatured = !product.isFeatured
            const updateProduct = await product.save()
            await updateFeaturedProductsCache()
            res.json(updateProduct)
        }else {
			res.status(404).json({ message: "Product not found" });
        }
    } catch (error) {
		console.log("Error in toggleFeaturedProduct controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
}

async function updateFeaturedProductsCache() {
    try {
        const featuredProducts = await Product.find({ isFeatured: true }).lean()
        await redis.set("featured_products", JSON.stringify(featuredProducts))
    } catch (error) {
        console.log("error in update cache function")
    }
}